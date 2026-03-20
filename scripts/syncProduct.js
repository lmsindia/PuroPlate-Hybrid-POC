require("dotenv").config();

const db = require("../config/db");
const shopify = require("../services/shopifyService");
const inventoryService = require("../services/inventoryService");

async function sync() {

  try {

    console.log("Fetching products to sync...");

    /* ------------------------------------------------
       STEP 1 — FIND PRODUCTS NOT YET SYNCED
    ------------------------------------------------ */

    const products = await db.query(`
      SELECT p.id, p.name
      FROM transaction.products p
      WHERE NOT EXISTS (
        SELECT 1
        FROM transaction.product_variants v
        WHERE v.product_id = p.id
        AND v.shopify_variant_id IS NOT NULL
      )
    `);

    console.log("Products found:", products.rows.length);


    /* ------------------------------------------------
       LOOP PRODUCTS
    ------------------------------------------------ */

    for (const productRow of products.rows) {

      console.log("Creating Shopify product:", productRow.name);


      /* ------------------------------------------------
         STEP 2 — FETCH VARIANTS
      ------------------------------------------------ */

      const variantRes = await db.query(`
        SELECT
          v.id,
          v.title,
          v.price,
          v.sku,
          COALESCE(i.available_quantity,0) AS available_quantity
        FROM transaction.product_variants v
        LEFT JOIN transaction.inventory i
        ON i.variant_id = v.id
        WHERE v.product_id = $1
      `,[productRow.id]);

      const variants = variantRes.rows;


      if (!variants.length) {

        console.log("No variants found for product:", productRow.id);
        continue;

      }


      /* ------------------------------------------------
         STEP 3 — FETCH ATTRIBUTES
      ------------------------------------------------ */

      const attrRes = await db.query(`
        SELECT
          m.category,
          m.name,
          pa.attribute_value
        FROM transaction.product_attributes pa
        JOIN transaction.product_attributes_master m
        ON m.id = pa.attribute_id
        WHERE pa.product_id = $1
      `,[productRow.id]);

      const attributes = attrRes.rows;


      /* ------------------------------------------------
         STEP 4 — BUILD SHOPIFY VARIANTS
      ------------------------------------------------ */

      const shopifyVariants = variants.map(v => ({

        option1: v.title,

        price: v.price,

        sku: v.sku,

        inventory_management: "shopify",

        inventory_policy: "deny",

        requires_shipping: true

      }));


      /* ------------------------------------------------
         STEP 5 — BUILD TAGS
      ------------------------------------------------ */

      const tags = attributes
        .map(a => `${a.category}:${a.attribute_value}`)
        .slice(0,20);


      /* ------------------------------------------------
         STEP 6 — BUILD METAFIELDS
      ------------------------------------------------ */

      const metafields = attributes.map(a => ({

        namespace: "custom",

        key: a.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g,"_")
          .replace(/_+/g,"_"),

        type: "single_line_text_field",

        value: String(a.attribute_value)

      }));


      console.log("Tags:", tags.join(", "));
      console.log("Metafields:", metafields.length);


      /* ------------------------------------------------
         STEP 7 — CREATE PRODUCT IN SHOPIFY
      ------------------------------------------------ */

      const product = await shopify.createProduct({

        title: productRow.name,
        published:true,

        options: [{ name: "Variant" }],

        variants: shopifyVariants,

        tags: tags.join(","),

        metafields: metafields

      });


      console.log("Shopify product created:", product.id);


      /* ------------------------------------------------
         STEP 8 — MAP VARIANTS + SET INVENTORY
      ------------------------------------------------ */

      for (const shopifyVariant of product.variants) {

        const dbVariant = variants.find(
          v => v.sku && v.sku === shopifyVariant.sku
        );

        if (!dbVariant) {

          console.log("Variant mapping failed:", shopifyVariant.sku);
          continue;

        }


        await db.query(`
          UPDATE transaction.product_variants
          SET
            shopify_variant_id = $1,
            shopify_inventory_item_id = $2
          WHERE id = $3
        `,[

          shopifyVariant.id,

          shopifyVariant.inventory_item_id,

          dbVariant.id

        ]);


        /* -------------------------
           SYNC INVENTORY
        ------------------------- */

        try {

          await inventoryService.setInventory(

            shopifyVariant.inventory_item_id,

            Number(dbVariant.available_quantity)

          );

        }
        catch(err){

          console.log("Inventory sync failed:", err.message);

        }


        console.log(

          `Mapped variant ${dbVariant.id} → Shopify ${shopifyVariant.id}`

        );

      }


      /* ------------------------------------------------
         RATE LIMIT PROTECTION
      ------------------------------------------------ */

      await new Promise(r => setTimeout(r,300));

    }


    console.log("MULTI VARIANT + ATTRIBUTE SYNC COMPLETE");

  }
  catch (err) {

    console.error(

      "SYNC FAILED:",

      err.response?.data || err.message

    );

  }

}


sync();