const db = require("../../../config/db");
const inventoryService = require("../../inventoryService");
const logger = require("../../../utils/logger");

module.exports = async function handleOrdersPaid(order, meta) {
  let client;

  try {
    const webhookEvent = {
      source: "shopify",
      eventType: meta.topic || "orders/paid",
      externalEventId: meta.webhookId || `shopify-order-${order.id}`
    };

    client = await db.connect();
    await client.query("BEGIN");

    const inventorySyncQueue = [];
    let webhookEventRowId;

    // 🔒 Advisory lock
    await client.query(`
      SELECT pg_advisory_xact_lock(
        hashtext($1),
        hashtext($2)
      )
    `, [
      webhookEvent.source,
      webhookEvent.externalEventId
    ]);

    // 🔁 Check existing webhook
    const existingWebhookEvent = await client.query(`
      SELECT id, processed
      FROM transaction.webhook_events
      WHERE source = $1
        AND event_type = $2
        AND external_event_id = $3
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `, [
      webhookEvent.source,
      webhookEvent.eventType,
      webhookEvent.externalEventId
    ]);

    if (existingWebhookEvent.rows[0]?.processed) {
      await client.query("COMMIT");
      logger.info("webhook.replay_ignored", {
        shopifyOrderId: order.id,
        externalEventId: webhookEvent.externalEventId
      });
      return;
    }

    if (existingWebhookEvent.rows.length) {
      webhookEventRowId = existingWebhookEvent.rows[0].id;
    } else {
      const result = await client.query(`
        INSERT INTO transaction.webhook_events
        (source,event_type,external_event_id,payload,processed)
        VALUES ($1,$2,$3,$4,FALSE)
        RETURNING id
      `, [
        webhookEvent.source,
        webhookEvent.eventType,
        webhookEvent.externalEventId,
        order
      ]);

      webhookEventRowId = result.rows[0].id;
    }

    // 🧾 Insert order
    const orderResult = await client.query(`
      INSERT INTO transaction.orders
      (
        shopify_order_id,
        currency_code,
        subtotal_amount,
        tax_amount,
        shipping_amount,
        total_amount,
        placed_at,
        raw_payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (shopify_order_id) DO NOTHING
      RETURNING id
    `, [
      order.id,
      order.currency,
      order.subtotal_price,
      order.total_tax,
      order.total_shipping_price_set?.shop_money?.amount || 0,
      order.total_price,
      order.created_at,
      order
    ]);

    if (!orderResult.rows.length) {
      await client.query(`
        UPDATE transaction.webhook_events
        SET processed = TRUE,
            processed_at = NOW()
        WHERE id = $1
      `, [webhookEventRowId]);

      await client.query("COMMIT");

      logger.info("webhook.order_already_exists", {
        shopifyOrderId: order.id
      });

      return;
    }

    const orderId = orderResult.rows[0].id;

    // 📦 Process line items
    for (const item of order.line_items) {
      const variantResult = await client.query(`
        SELECT id, vendor_id, shopify_inventory_item_id
        FROM transaction.product_variants
        WHERE shopify_variant_id = $1
      `, [item.variant_id]);

      if (!variantResult.rows.length) {
        throw new Error(`Variant mapping missing: ${item.variant_id}`);
      }

      const variant = variantResult.rows[0];

      const orderItemResult = await client.query(`
        INSERT INTO transaction.order_items
        (
          order_id,variant_id,vendor_id,shopify_line_item_id,
          product_name,variant_title,sku,
          quantity,unit_price,total_price
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [
        orderId,
        variant.id,
        variant.vendor_id,
        item.id,
        item.title,
        item.variant_title,
        item.sku,
        item.quantity,
        item.price,
        item.price * item.quantity
      ]);

      const orderItemId = orderItemResult.rows[0].id;

      // 📉 Inventory update
      const invResult = await client.query(`
        UPDATE transaction.inventory
        SET available_quantity = available_quantity - $1
        WHERE variant_id = $2
          AND available_quantity >= $1
        RETURNING available_quantity
      `, [item.quantity, variant.id]);

      const newQty = invResult.rows[0]?.available_quantity;

      if (newQty === undefined) {
        throw new Error(`Insufficient inventory for variant ${variant.id}`);
      }

      if (variant.shopify_inventory_item_id) {
        inventorySyncQueue.push({
          inventoryItemId: variant.shopify_inventory_item_id,
          quantity: newQty
        });
      }

      // 💰 Vendor commission
      const commissionResult = await client.query(`
        SELECT commission_value
        FROM marketplace.vendor_commissions
        WHERE vendor_id = $1
        LIMIT 1
      `, [variant.vendor_id]);

      const commissionRate =
        commissionResult.rows[0]?.commission_value || 20;

      const total = item.price * item.quantity;
      const commission = total * (commissionRate / 100);
      const vendorAmount = total - commission;

      await client.query(`
        INSERT INTO marketplace.vendor_wallet_transactions
        (vendor_id,order_item_id,transaction_type,amount)
        VALUES ($1,$2,'order_credit',$3)
      `, [variant.vendor_id, orderItemId, vendorAmount]);

      await client.query(`
        UPDATE marketplace.vendor_wallets
        SET balance = balance + $1
        WHERE vendor_id = $2
      `, [vendorAmount, variant.vendor_id]);
    }

    // 📦 Vendor fulfillment
    const vendors = await client.query(`
      SELECT DISTINCT vendor_id
      FROM transaction.order_items
      WHERE order_id = $1
    `, [orderId]);

    for (const v of vendors.rows) {
      await client.query(`
        INSERT INTO transaction.order_vendor_fulfillments
        (order_id,vendor_id,fulfillment_status)
        VALUES ($1,$2,'pending')
      `, [orderId, v.vendor_id]);
    }

    // ✅ Mark processed
    await client.query(`
      UPDATE transaction.webhook_events
      SET processed = TRUE,
          processed_at = NOW()
      WHERE id = $1
    `, [webhookEventRowId]);

    await client.query("COMMIT");

    // 🔄 Async inventory sync
    for (const item of inventorySyncQueue) {
      try {
        await inventoryService.setInventory(
          item.inventoryItemId,
          item.quantity
        );
      } catch (err) {
        logger.error("inventory_sync_failed", {
          inventoryItemId: item.inventoryItemId,
          error: err.message
        });
      }
    }

    logger.info("webhook.processed", {
      shopifyOrderId: order.id
    });

  } catch (err) {
    if (client) await client.query("ROLLBACK");

    logger.error("webhook.processing_failed", {
      error: err.message
    });

    throw err;
  } finally {
    if (client) client.release();
  }
};
