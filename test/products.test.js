const assert = require("node:assert/strict");
const { startRouteServer } = require("./helpers/routeTestUtils");

async function runHappyPathTest() {
  const dbMock = {
    async query() {
      return {
        rows: [
          {
            id: 1,
            name: "Hybrid Tee",
            slug: "hybrid-tee",
            variant_id: 10,
            variant_title: "Small",
            price: "499.00",
            available_quantity: 7,
            shopify_variant_id: "1001",
            category: "size",
            attribute_name: "Size",
            attribute_value: "Small"
          },
          {
            id: 1,
            name: "Hybrid Tee",
            slug: "hybrid-tee",
            variant_id: 10,
            variant_title: "Small",
            price: "499.00",
            available_quantity: 7,
            shopify_variant_id: "1001",
            category: "color",
            attribute_name: "Color",
            attribute_value: "Black"
          }
        ]
      };
    }
  };

  const server = await startRouteServer("routes/products.js", "/api/products", {
    "config/db.js": dbMock
  });

  try {
    const response = await server.request({
      path: "/api/products"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, [
      {
        id: 1,
        name: "Hybrid Tee",
        slug: "hybrid-tee",
        variants: [
          {
            variant_id: 10,
            title: "Small",
            price: "499.00",
            stock: 7,
            shopify_variant_id: "1001"
          }
        ],
        attributes: [
          {
            category: "size",
            name: "Size",
            value: "Small"
          },
          {
            category: "color",
            name: "Color",
            value: "Black"
          }
        ]
      }
    ]);
  } finally {
    await server.close();
  }
}

async function runDatabaseUnavailableTest() {
  const dbMock = {
    async query() {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:5432");
      err.code = "ECONNREFUSED";
      throw err;
    }
  };

  const server = await startRouteServer("routes/products.js", "/api/products", {
    "config/db.js": dbMock
  });

  try {
    const response = await server.request({
      path: "/api/products"
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      error: "Service unavailable",
      requestId: "test-request-id"
    });
  } finally {
    await server.close();
  }
}

async function run() {
  await runHappyPathTest();
  await runDatabaseUnavailableTest();
}

module.exports = {
  name: "products route returns nested variants and handles DB outages",
  run
};
