const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        p.id,
        p.name,
        p.slug,

        -- variant info
        v.id AS variant_id,
        v.title AS variant_title,
        v.price,
        i.available_quantity,

        REPLACE(
          v.shopify_variant_id,
          'gid://shopify/ProductVariant/',
          ''
        ) AS shopify_variant_id,

        -- attributes
        m.category,
        m.name AS attribute_name,
        pa.attribute_value
      FROM transaction.products p
      JOIN transaction.product_variants v
        ON v.product_id = p.id
      LEFT JOIN transaction.inventory i
        ON i.variant_id = v.id
      LEFT JOIN transaction.product_attributes pa
        ON pa.product_id = p.id
      LEFT JOIN transaction.product_attributes_master m
        ON m.id = pa.attribute_id
      WHERE p.status = 'active'
      ORDER BY p.id, v.id
    `);

    // Transform flat rows into a nested product response.
    const products = {};

    for (const row of result.rows) {
      if (!products[row.id]) {
        products[row.id] = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          variants: [],
          attributes: []
        };
      }

      if (!products[row.id].variants.some(v => v.variant_id === row.variant_id)) {
        products[row.id].variants.push({
          variant_id: row.variant_id,
          title: row.variant_title,
          price: row.price,
          stock: row.available_quantity,
          shopify_variant_id: row.shopify_variant_id
        });
      }

      if (row.attribute_name) {
        const attrExists =
          products[row.id].attributes.some(a =>
            a.name === row.attribute_name &&
            a.value === row.attribute_value
          );

        if (!attrExists) {
          products[row.id].attributes.push({
            category: row.category,
            name: row.attribute_name,
            value: row.attribute_value
          });
        }
      }
    }

    res.json(Object.values(products));
  }
  catch (err) {
    next(err);
  }
});

module.exports = router;
