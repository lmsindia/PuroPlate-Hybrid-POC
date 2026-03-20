const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startRouteServer } = require("./helpers/routeTestUtils");

function signPayload(secret, payload) {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload), "utf8")
    .digest("base64");
}

async function runProcessEventTest() {
  process.env.SHOPIFY_WEBHOOK_SECRET = "webhook-secret";

  const orderPayload = {
    id: 501,
    currency: "INR",
    subtotal_price: 1000,
    total_tax: 180,
    total_shipping_price_set: {
      shop_money: {
        amount: 50
      }
    },
    total_price: 1230,
    created_at: "2026-03-16T10:00:00Z",
    line_items: [
      {
        id: 701,
        variant_id: "1001",
        title: "Hybrid Tee",
        variant_title: "Small",
        sku: "TEE-S",
        quantity: 1,
        price: 1000
      }
    ]
  };

  const recordedQueries = [];
  const inventoryCalls = [];

  const client = {
    async query(sql, params = []) {
      recordedQueries.push({
        sql,
        params
      });

      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("pg_advisory_xact_lock")) {
        return { rows: [] };
      }

      if (sql.includes("FROM transaction.webhook_events")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO transaction.webhook_events")) {
        return { rows: [{ id: 900 }] };
      }

      if (sql.includes("INSERT INTO transaction.orders")) {
        return { rows: [{ id: 100 }] };
      }

      if (sql.includes("FROM transaction.product_variants")) {
        return {
          rows: [
            {
              id: 10,
              vendor_id: 5,
              shopify_inventory_item_id: "inv-1"
            }
          ]
        };
      }

      if (sql.includes("INSERT INTO transaction.order_items")) {
        return { rows: [{ id: 200 }] };
      }

      if (sql.includes("UPDATE transaction.inventory")) {
        return { rows: [{ available_quantity: 4 }] };
      }

      if (sql.includes("FROM marketplace.vendor_commissions")) {
        return { rows: [{ commission_value: 10 }] };
      }

      if (sql.includes("INSERT INTO marketplace.vendor_wallet_transactions")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE marketplace.vendor_wallets")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT DISTINCT vendor_id")) {
        return { rows: [{ vendor_id: 5 }] };
      }

      if (sql.includes("INSERT INTO transaction.order_vendor_fulfillments")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE transaction.webhook_events")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {}
  };

  const dbMock = {
    async connect() {
      return client;
    }
  };

  const inventoryServiceMock = {
    async setInventory(inventoryItemId, quantity) {
      inventoryCalls.push({
        inventoryItemId,
        quantity
      });
    }
  };

  const server = await startRouteServer(
    "routes/shopifyWebhook.js",
    "/webhooks/shopify",
    {
      "config/db.js": dbMock,
      "services/inventoryService.js": inventoryServiceMock
    }
  );

  try {
    const response = await server.request({
      method: "POST",
      path: "/webhooks/shopify/order-created",
      headers: {
        "x-shopify-hmac-sha256": signPayload(
          process.env.SHOPIFY_WEBHOOK_SECRET,
          orderPayload
        ),
        "x-shopify-webhook-id": "evt-501",
        "x-shopify-topic": "orders/create"
      },
      body: orderPayload
    });

    assert.equal(response.statusCode, 200);
    assert.equal(inventoryCalls.length, 1);
    assert.deepEqual(inventoryCalls[0], {
      inventoryItemId: "inv-1",
      quantity: 4
    });
    assert.ok(recordedQueries.some(query =>
      query.sql.includes("INSERT INTO transaction.webhook_events")
    ));
    assert.ok(recordedQueries.some(query =>
      query.sql.includes("UPDATE transaction.webhook_events")
    ));
  } finally {
    await server.close();
  }
}

async function runDuplicateReplayTest() {
  process.env.SHOPIFY_WEBHOOK_SECRET = "webhook-secret";

  const orderPayload = {
    id: 999,
    currency: "INR",
    subtotal_price: 100,
    total_tax: 10,
    total_shipping_price_set: {
      shop_money: {
        amount: 0
      }
    },
    total_price: 110,
    created_at: "2026-03-16T10:00:00Z",
    line_items: []
  };

  const recordedQueries = [];
  const inventoryCalls = [];

  const client = {
    async query(sql, params = []) {
      recordedQueries.push({
        sql,
        params
      });

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("pg_advisory_xact_lock")) {
        return { rows: [] };
      }

      if (sql.includes("FROM transaction.webhook_events")) {
        return {
          rows: [
            {
              id: 901,
              processed: true
            }
          ]
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {}
  };

  const dbMock = {
    async connect() {
      return client;
    }
  };

  const inventoryServiceMock = {
    async setInventory(inventoryItemId, quantity) {
      inventoryCalls.push({
        inventoryItemId,
        quantity
      });
    }
  };

  const server = await startRouteServer(
    "routes/shopifyWebhook.js",
    "/webhooks/shopify",
    {
      "config/db.js": dbMock,
      "services/inventoryService.js": inventoryServiceMock
    }
  );

  try {
    const response = await server.request({
      method: "POST",
      path: "/webhooks/shopify/order-created",
      headers: {
        "x-shopify-hmac-sha256": signPayload(
          process.env.SHOPIFY_WEBHOOK_SECRET,
          orderPayload
        ),
        "x-shopify-webhook-id": "evt-999",
        "x-shopify-topic": "orders/create"
      },
      body: orderPayload
    });

    assert.equal(response.statusCode, 200);
    assert.equal(inventoryCalls.length, 0);
    assert.equal(
      recordedQueries.some(query =>
        query.sql.includes("INSERT INTO transaction.orders")
      ),
      false
    );
  } finally {
    await server.close();
  }
}

async function run() {
  await runProcessEventTest();
  await runDuplicateReplayTest();
}

module.exports = {
  name: "webhook processes events once and ignores duplicate replays",
  run
};
