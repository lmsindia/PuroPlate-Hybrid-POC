const assert = require("node:assert/strict");
const { startRouteServer } = require("./helpers/routeTestUtils");

async function run() {
  process.env.SHOPIFY_STORE = "store.test";

  const dbMock = {
    async query() {
      return {
        rows: [
          {
            id: 1,
            shopify_variant_id: "1001",
            available_quantity: 3
          }
        ]
      };
    }
  };

  const server = await startRouteServer("routes/checkout.js", "/api/checkout", {
    "config/db.js": dbMock
  });

  try {
    const response = await server.request({
      method: "POST",
      path: "/api/checkout",
      body: {
        items: [
          {
            variantId: "gid://shopify/ProductVariant/1001",
            quantity: 2
          },
          {
            variantId: "1001",
            quantity: 1
          }
        ]
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      checkoutUrl: "https://store.test/cart/1001:3?checkout"
    });
  } finally {
    await server.close();
  }
}

module.exports = {
  name: "checkout builds a permalink only for trusted in-stock variants",
  run
};
