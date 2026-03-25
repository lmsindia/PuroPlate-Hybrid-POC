// controllers/productController.js

const db = require("../config/db");

exports.createProduct = async (req, res) => {

  const { name, variants } = req.body;

  await db.query("BEGIN");

  try {

    const product = await db.query(`
      INSERT INTO transaction.products
      (name,status)
      VALUES ($1,'pending')
      RETURNING id
    `,[name]);

    const productId = product.rows[0].id;

    for (const v of variants) {

      const variant = await db.query(`
        INSERT INTO transaction.product_variants
        (product_id,title,price,sku)
        VALUES ($1,$2,$3,$4)
        RETURNING id
      `,[productId, v.title, v.price, v.sku]);

      await db.query(`
        INSERT INTO transaction.inventory
        (variant_id,available_quantity)
        VALUES ($1,$2)
      `,[variant.rows[0].id, v.stock]);
    }

    await db.query("COMMIT");

    res.json({ productId });

  }
  catch (err) {

    await db.query("ROLLBACK");
    res.status(500).json({ error: err.message });

  }

};