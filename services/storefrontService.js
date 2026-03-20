const axios = require("axios");
const https = require("https");

const storefront = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE}/api/${process.env.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`,
  headers: {
    "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
    "Content-Type": "application/json"
  },
    httpsAgent: new https.Agent({
    rejectUnauthorized: true   // DEV ONLY
  })
});

async function createCheckout(items) {

  const lines = items.map(i => ({
    merchandiseId: `gid://shopify/ProductVariant/${i.variantId}`,
    quantity: i.quantity
  }));

  const query = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }`;

  const res = await storefront.post("", {
    query,
    variables: {
      input: {
        lines
      }
    }
  });

  // -----------------------------
  // SAFETY VALIDATION
  // -----------------------------
  if (!res.data || !res.data.data) {
    console.error("Shopify raw response:", res.data);
    throw new Error("Invalid Shopify response");
  }

  const data = res.data.data.cartCreate;

  if (data.userErrors.length) {
    throw new Error(data.userErrors[0].message);
  }

  return {
    cartId: data.cart.id,
    checkoutUrl: data.cart.checkoutUrl
  };
}

module.exports = { createCheckout };
