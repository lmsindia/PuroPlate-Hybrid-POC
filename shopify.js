const axios = require("axios");

const shop = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ACCESS_TOKEN;

const shopify = axios.create({
    baseURL: `https://${shop}/admin/api/2026-01`,
    headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json"
    }
});

async function createShopifyProduct(product) {
    const response = await shopify.post("/products.json", {
        product: {
            title: product.name,
            body_html: product.description,
            variants: [
                {
                    price: product.price,
                    sku: product.sku
                }
            ]
        }
    });

    return response.data.product;
}

module.exports = { createShopifyProduct };
