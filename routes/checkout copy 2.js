const express = require("express");
const router = express.Router();
const storefront = require("../services/storefrontService");
const db = require("../config/db");

router.post("/", async (req, res) => {

  try {

    const { items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Cart empty" });
    }

    // -----------------------------------
    // CREATE SHOPIFY CART / CHECKOUT
    // -----------------------------------
    const session = await storefront.createCheckout(items);

    if (!session || !session.checkoutUrl) {
      throw new Error("Checkout creation failed");
    }

    // -----------------------------------
    // STORE CHECKOUT SESSION (STEP 5)
    // -----------------------------------
    await db.query(`
      INSERT INTO transaction.checkout_sessions
      (shopify_cart_id, checkout_url)
      VALUES ($1,$2)
    `,[
      session.cartId,
      session.checkoutUrl
    ]);

    // -----------------------------------
    // RETURN CLEAN RESPONSE
    // -----------------------------------
    res.json({
      checkoutUrl: session.checkoutUrl
    });

  }
  catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;