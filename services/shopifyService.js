const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({
  rejectUnauthorized: true
});


const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}`,
  httpsAgent,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
  }
});

function createCheckoutSession(variantId, quantity) {

  const checkoutUrl =
    `https://${process.env.SHOPIFY_STORE}/cart/${variantId}:${quantity}`;

  return checkoutUrl;
}


async function createProduct(productData) {
  const res = await shopify.post("/products.json", {
    product: productData
  });
  return res.data.product;
}

module.exports = {
  createCheckoutSession,
  createProduct
};
