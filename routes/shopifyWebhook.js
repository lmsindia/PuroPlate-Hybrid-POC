const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../config/db");
const inventoryService = require("../services/inventoryService");
const logger = require("../utils/logger");

function verifyWebhook(req) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!hmacHeader) return false;

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, "utf8")
    .digest("base64");

  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);

  if (digestBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

function getWebhookEventMeta(req, order) {
  return {
    source: "shopify",
    eventType: req.headers["x-shopify-topic"] || "orders/create",
    externalEventId:
      req.headers["x-shopify-webhook-id"] || `shopify-order-${order.id}`
  };
}

router.post("/order-created", async (req, res) => {
  let client;

  try {
    if (!verifyWebhook(req)) {
      logger.warn("webhook.verification_failed", {
        requestId: req.requestId
      });
      return res.sendStatus(401);
    }

    const order = JSON.parse(req.rawBody);
    const webhookEvent = getWebhookEventMeta(req, order);

    client = await db.connect();
    await client.query("BEGIN");
    const inventorySyncQueue = [];
    let webhookEventRowId;

    await client.query(`
      SELECT pg_advisory_xact_lock(
        hashtext($1),
        hashtext($2)
      )
    `, [
      webhookEvent.source,
      webhookEvent.externalEventId
    ]);

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
        requestId: req.requestId,
        shopifyOrderId: order.id,
        externalEventId: webhookEvent.externalEventId
      });
      return res.sendStatus(200);
    }

    if (existingWebhookEvent.rows.length) {
      webhookEventRowId = existingWebhookEvent.rows[0].id;
    } else {
      const webhookEventResult = await client.query(`
        INSERT INTO transaction.webhook_events
        (
          source,
          event_type,
          external_event_id,
          payload,
          processed
        )
        VALUES ($1,$2,$3,$4,FALSE)
        RETURNING id
      `, [
        webhookEvent.source,
        webhookEvent.eventType,
        webhookEvent.externalEventId,
        order
      ]);

      webhookEventRowId = webhookEventResult.rows[0].id;
    }

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
    `,[
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
        requestId: req.requestId,
        shopifyOrderId: order.id,
        externalEventId: webhookEvent.externalEventId
      });
      return res.sendStatus(200);
    }

    const orderId = orderResult.rows[0].id;

    for (const item of order.line_items) {
      const variantResult = await client.query(`
        SELECT
          id,
          vendor_id,
          shopify_inventory_item_id
        FROM transaction.product_variants
        WHERE shopify_variant_id = $1
      `,[item.variant_id]);

      if (!variantResult.rows.length) {
        throw new Error(`Variant mapping missing: ${item.variant_id}`);
      }

      const variant = variantResult.rows[0];
      const localVariantId = variant.id;
      const vendorId = variant.vendor_id;
      const inventoryItemId = variant.shopify_inventory_item_id;

      const orderItemResult = await client.query(`
        INSERT INTO transaction.order_items
        (
          order_id,
          variant_id,
          vendor_id,
          shopify_line_item_id,
          product_name,
          variant_title,
          sku,
          quantity,
          unit_price,
          total_price
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `,[
        orderId,
        localVariantId,
        vendorId,
        item.id,
        item.title,
        item.variant_title,
        item.sku,
        item.quantity,
        item.price,
        item.price * item.quantity
      ]);

      const orderItemId = orderItemResult.rows[0].id;

      const invResult = await client.query(`
        UPDATE transaction.inventory
        SET available_quantity = available_quantity - $1
        WHERE variant_id = $2
          AND available_quantity >= $1
        RETURNING available_quantity
      `,[item.quantity, localVariantId]);

      const newQty = invResult.rows[0]?.available_quantity;

      if (newQty === undefined) {
        throw new Error(`Insufficient inventory for variant ${localVariantId}`);
      }

      if (inventoryItemId) {
        inventorySyncQueue.push({
          inventoryItemId,
          quantity: newQty
        });
      }

      const commissionResult = await client.query(`
        SELECT commission_value
        FROM marketplace.vendor_commissions
        WHERE vendor_id = $1
        LIMIT 1
      `,[vendorId]);

      const commissionRate =
        commissionResult.rows[0]?.commission_value || 20;

      const commission =
        (item.price * item.quantity) * (commissionRate / 100);

      const vendorAmount =
        (item.price * item.quantity) - commission;

      await client.query(`
        INSERT INTO marketplace.vendor_wallet_transactions
        (vendor_id,order_item_id,transaction_type,amount)
        VALUES ($1,$2,'order_credit',$3)
      `,[vendorId,orderItemId,vendorAmount]);

      await client.query(`
        UPDATE marketplace.vendor_wallets
        SET balance = balance + $1
        WHERE vendor_id = $2
      `,[vendorAmount,vendorId]);
    }

    const vendors = await client.query(`
      SELECT DISTINCT vendor_id
      FROM transaction.order_items
      WHERE order_id = $1
    `,[orderId]);

    for (const vendorRow of vendors.rows) {
      await client.query(`
        INSERT INTO transaction.order_vendor_fulfillments
        (order_id,vendor_id,fulfillment_status)
        VALUES ($1,$2,'pending')
      `,[orderId,vendorRow.vendor_id]);
    }

    await client.query(`
      UPDATE transaction.webhook_events
      SET processed = TRUE,
          processed_at = NOW()
      WHERE id = $1
    `, [webhookEventRowId]);

    await client.query("COMMIT");
    res.sendStatus(200);

    for (const syncItem of inventorySyncQueue) {
      try {
        await inventoryService.setInventory(
          syncItem.inventoryItemId,
          syncItem.quantity
        );
      } catch (err) {
        logger.error("webhook.inventory_sync_failed", {
          requestId: req.requestId,
          inventoryItemId: syncItem.inventoryItemId,
          error: err.message
        });
      }
    }

    logger.info("webhook.processed", {
      requestId: req.requestId,
      shopifyOrderId: order.id,
      externalEventId: webhookEvent.externalEventId
    });
  }
  catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        logger.error("webhook.rollback_failed", {
          requestId: req.requestId,
          error: rollbackErr.message
        });
      }
    }

    logger.error("webhook.processing_failed", {
      requestId: req.requestId,
      error: err.message
    });

    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
  finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
