const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {

  try {

    const { items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Cart empty" });
    }

    const cartString = items
      .map(i => `${i.variantId}:${i.quantity}`)
      .join(",");

    const checkoutUrl =
      `https://${process.env.SHOPIFY_STORE}/cart/${cartString}`;

    res.json({ checkoutUrl });

  }
  catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
