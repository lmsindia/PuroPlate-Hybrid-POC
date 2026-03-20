const express = require("express");
const router = express.Router();
const db = require("../config/db");
const cartService = require("../services/cartPermalinkService");

router.post("/", async (req, res, next) => {

  try {

    const requestedItems =
      cartService.sanitizeCheckoutItems(req.body?.items);

    const requestedVariantIds =
      requestedItems.map(item => item.variantId);

    const variantResult = await db.query(`
      SELECT
        v.id,
        REPLACE(
          v.shopify_variant_id,
          'gid://shopify/ProductVariant/',
          ''
        ) AS shopify_variant_id,
        COALESCE(i.available_quantity, 0) AS available_quantity
      FROM transaction.product_variants v
      JOIN transaction.products p
        ON p.id = v.product_id
      LEFT JOIN transaction.inventory i
        ON i.variant_id = v.id
      WHERE v.shopify_variant_id IS NOT NULL
        AND REPLACE(
          v.shopify_variant_id,
          'gid://shopify/ProductVariant/',
          ''
        ) = ANY($1::text[])
        AND p.status = 'active'
        AND COALESCE(v.status, 'active') = 'active'
    `, [requestedVariantIds]);

    const variantsByShopifyId = new Map(
      variantResult.rows.map(row => [
        row.shopify_variant_id,
        row
      ])
    );

    const trustedItems = requestedItems.map(item => {
      const variant = variantsByShopifyId.get(item.variantId);

      if (!variant) {
        throw new Error(`Invalid or inactive variant: ${item.variantId}`);
      }

      if (item.quantity > Number(variant.available_quantity)) {
        throw new Error(
          `Requested quantity exceeds stock for variant ${item.variantId}`
        );
      }

      return {
        variantId: variant.shopify_variant_id,
        quantity: item.quantity
      };
    });

    const checkoutUrl =
      cartService.createCheckout(trustedItems);

    res.json({
      checkoutUrl
    });

  }
  catch(err){

    if (
      err.message.includes("variant") ||
      err.message.includes("quantity") ||
      err.message.includes("Cart")
    ) {
      err.statusCode = 400;
    }

    next(err);

  }

});

module.exports = router;
