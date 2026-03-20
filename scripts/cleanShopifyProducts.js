require("dotenv").config();
const axios = require("axios");

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
  }
});

async function clearProducts() {

  console.log("Fetching products...");

  const res = await shopify.get("/products.json?limit=250");
  const products = res.data.products;

  console.log("Products found:", products.length);

  for (const product of products) {

    console.log("Deleting:", product.title);

    await shopify.delete(`/products/${product.id}.json`);
  }

  console.log("All products deleted");
}

clearProducts();
