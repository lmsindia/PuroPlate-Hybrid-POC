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

    // Respond immediately (Shopify timeout protection)
    res.sendStatus(200);


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
    // PROCESS LINE ITEMS + INVENTORY SYNC
    // --------------------------------------------------
    for (const item of order.line_items) {

      // Store line item
      await db.query(`
        INSERT INTO transaction.order_items
        (order_id, shopify_line_item_id, product_name, sku, quantity, unit_price, total_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,[
        orderId,
        item.id,
        item.title,
        item.sku,
        item.quantity,
        item.price,
        item.price * item.quantity
      ]);


      // --------------------------------------------------
      // FIND LOCAL VARIANT
      // --------------------------------------------------
      const variantResult = await db.query(`
        SELECT id, shopify_inventory_item_id
        FROM transaction.product_variants
        WHERE shopify_variant_id = $1
      `,[item.variant_id]);

      if (!variantResult.rows.length) {
        console.log("Variant mapping not found:", item.variant_id);
        continue;
      }

      const localVariantId = variantResult.rows[0].id;
      const inventoryItemId = variantResult.rows[0].shopify_inventory_item_id;


      // --------------------------------------------------
      // DEDUCT INVENTORY IN POSTGRESQL
      // --------------------------------------------------
      const invResult = await db.query(`
        UPDATE transaction.inventory
        SET available_quantity = available_quantity - $1
        WHERE variant_id = $2
        RETURNING available_quantity
      `,[item.quantity, localVariantId]);

      if (!invResult.rows.length) {
        console.log("Inventory row missing for variant:", localVariantId);
        continue;
      }

      const newQty = invResult.rows[0].available_quantity;


      // --------------------------------------------------
      // PUSH UPDATED STOCK TO SHOPIFY
      // --------------------------------------------------
      try {
        await inventoryService.setInventory(
          inventoryItemId,
          newQty
        );

        console.log(
          `Inventory synced → Variant ${localVariantId} = ${newQty}`
        );

      } catch (err) {
        console.error("Shopify inventory update failed:", err.message);
      }
    }

    console.log("Order stored and inventory synced:", order.id);

  }
  catch (err) {
    console.error("Webhook processing error:", err.message);
  }
});

module.exports = router;
