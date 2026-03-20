const axios = require("axios");

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
  }
});

async function setInventory(inventoryItemId, quantity) {

  await shopify.post("/inventory_levels/set.json", {
    location_id: process.env.SHOPIFY_LOCATION_ID,
    inventory_item_id: inventoryItemId,
    available: quantity
  });
}

module.exports = { setInventory };
