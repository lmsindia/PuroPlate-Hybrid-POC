const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../config/db");
const inventoryService = require("../services/inventoryService");


// --------------------------------------------------
// VERIFY SHOPIFY WEBHOOK SIGNATURE
// --------------------------------------------------
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



// --------------------------------------------------
// ORDER CREATED WEBHOOK
// --------------------------------------------------
router.post("/order-created", async (req, res) => {

  try {

    if (!verifyWebhook(req)) {
      console.log("Webhook verification failed");
      return res.sendStatus(401);
    }

    const order = JSON.parse(req.rawBody);

    res.sendStatus(200); // respond immediately


    // --------------------------------------------------
    // STORE ORDER MASTER
    // --------------------------------------------------
    const orderResult = await db.query(`
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
      console.log("Order already exists:", order.id);
      return;
    }

    const orderId = orderResult.rows[0].id;



    // --------------------------------------------------
    // STORE LINE ITEMS
    // --------------------------------------------------
    for (const item of order.line_items) {

      // FIND LOCAL VARIANT + VENDOR
      const variantResult = await db.query(`
        SELECT
          id,
          vendor_id,
          shopify_inventory_item_id
        FROM transaction.product_variants
        WHERE shopify_variant_id = $1
      `,[item.variant_id]);

      if (!variantResult.rows.length) {
        console.log("Variant mapping missing:", item.variant_id);
        continue;
      }

      const variant = variantResult.rows[0];

      const localVariantId = variant.id;
      const vendorId = variant.vendor_id;
      const inventoryItemId = variant.shopify_inventory_item_id;



      // --------------------------------------------------
      // STORE ORDER ITEM
      // --------------------------------------------------
      const orderItemResult = await db.query(`
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



      // --------------------------------------------------
      // INVENTORY DEDUCTION (LOCAL)
      // --------------------------------------------------
      const invResult = await db.query(`
        UPDATE transaction.inventory
        SET available_quantity = available_quantity - $1
        WHERE variant_id = $2
        RETURNING available_quantity
      `,[item.quantity, localVariantId]);

      const newQty = invResult.rows[0]?.available_quantity;



      // --------------------------------------------------
      // PUSH INVENTORY UPDATE TO SHOPIFY
      // --------------------------------------------------
      if (newQty !== undefined) {

        try {

          await inventoryService.setInventory(
            inventoryItemId,
            newQty
          );

        } catch (err) {

          console.log("Shopify inventory sync failed:", err.message);

        }

      }



      // --------------------------------------------------
      // CREDIT VENDOR WALLET
      // --------------------------------------------------
      const commissionResult = await db.query(`
        SELECT commission_value
        FROM marketplace.vendor_commissions
        WHERE vendor_id=$1
        LIMIT 1
      `,[vendorId]);

      const commissionRate =
        commissionResult.rows[0]?.commission_value || 20;

      const commission =
        (item.price * item.quantity) * (commissionRate / 100);

      const vendorAmount =
        (item.price * item.quantity) - commission;


      await db.query(`
        INSERT INTO marketplace.vendor_wallet_transactions
        (vendor_id,order_item_id,transaction_type,amount)
        VALUES ($1,$2,'order_credit',$3)
      `,[vendorId,orderItemId,vendorAmount]);


      await db.query(`
        UPDATE marketplace.vendor_wallets
        SET balance = balance + $1
        WHERE vendor_id=$2
      `,[vendorAmount,vendorId]);

    }



    // --------------------------------------------------
    // SPLIT ORDER FOR VENDOR FULFILLMENT
    // --------------------------------------------------
    const vendors = await db.query(`
      SELECT DISTINCT vendor_id
      FROM transaction.order_items
      WHERE order_id=$1
    `,[orderId]);

    for (const v of vendors.rows) {

      await db.query(`
        INSERT INTO transaction.order_vendor_fulfillments
        (order_id,vendor_id,fulfillment_status)
        VALUES ($1,$2,'pending')
      `,[orderId,v.vendor_id]);

    }


    console.log("Order processed successfully:", order.id);

  }
  catch (err) {

    console.error("Webhook processing error:", err.message);

  }

});

module.exports = router;