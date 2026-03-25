const assert = require("node:assert/strict");
const { startRouteServer } = require("./helpers/routeTestUtils");

function createAuthMock() {
  return (req, res, next) => {
    req.user = { id: 7 };
    next();
  };
}

function clearVendorController() {
  delete require.cache[require.resolve("../controllers/vendorController")];
}

async function runCreateVendorHappyPathTest() {
  const calls = [];
  const dbMock = {
    async query(sql, params) {
      calls.push({ sql, params });

      if (sql.includes("FROM marketplace.users")) {
        return {
          rows: [
            {
              id: 7,
              email: "vendor@example.com"
            }
          ]
        };
      }

      if (sql.includes("INSERT INTO marketplace.vendors")) {
        return {
          rows: [
            {
              id: 123
            }
          ]
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  clearVendorController();

  const server = await startRouteServer("routes/vendors.js", "/api/vendors", {
    "config/db.js": dbMock,
    "middleware/authMiddleware.js": createAuthMock()
  });

  try {
    const response = await server.request({
      method: "POST",
      path: "/api/vendors",
      body: {
        name: "Idrees Ali Aashi"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      vendorId: 123
    });
    assert.deepEqual(calls[1].params, ["Idrees Ali Aashi", "vendor@example.com"]);
  } finally {
    await server.close();
  }
}

async function runGetProfileHappyPathTest() {
  const dbMock = {
    async query(sql, params) {
      if (sql.includes("FROM marketplace.users")) {
        return {
          rows: [
            {
              id: 7,
              email: "vendor@example.com"
            }
          ]
        };
      }

      if (sql.includes("FROM marketplace.vendors")) {
        return {
          rows: [
            {
              id: 123,
              name: "Idrees Ali Aashi",
              email: "vendor@example.com",
              status: "pending"
            }
          ]
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  clearVendorController();

  const server = await startRouteServer("routes/vendors.js", "/api/vendors", {
    "config/db.js": dbMock,
    "middleware/authMiddleware.js": createAuthMock()
  });

  try {
    const response = await server.request({
      path: "/api/vendors/me"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      id: 123,
      name: "Idrees Ali Aashi",
      email: "vendor@example.com",
      status: "pending"
    });
  } finally {
    await server.close();
  }
}

async function run() {
  await runCreateVendorHappyPathTest();
  await runGetProfileHappyPathTest();
}

module.exports = {
  name: "vendor routes resolve account email before create and profile lookup",
  run
};
