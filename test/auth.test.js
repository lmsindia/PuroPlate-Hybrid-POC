const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { startRouteServer } = require("./helpers/routeTestUtils");

function clearAuthController() {
  delete require.cache[require.resolve("../controllers/authController")];
}

async function runRegisterValidationTest() {
  let queryCalled = false;

  clearAuthController();

  const server = await startRouteServer("routes/auth.js", "/api/auth", {
    "config/db.js": {
      async query() {
        queryCalled = true;
        throw new Error("query should not run");
      }
    }
  });

  try {
    const response = await server.request({
      method: "POST",
      path: "/api/auth/register",
      body: {
        email: "vendor@example.com"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      error: "Email and password are required"
    });
    assert.equal(queryCalled, false);
  } finally {
    await server.close();
  }
}

async function runLoginHappyPathTest() {
  process.env.JWT_SECRET = "test-secret";

  const passwordHash = await bcrypt.hash("correct-password", 10);

  clearAuthController();

  const server = await startRouteServer("routes/auth.js", "/api/auth", {
    "config/db.js": {
      async query() {
        return {
          rows: [
            {
              id: 42,
              password_hash: passwordHash
            }
          ]
        };
      }
    }
  });

  try {
    const response = await server.request({
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: "vendor@example.com",
        password: "correct-password"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(typeof response.body.token, "string");
  } finally {
    await server.close();
  }
}

async function run() {
  await runRegisterValidationTest();
  await runLoginHappyPathTest();
}

module.exports = {
  name: "auth routes validate required fields and return a login token",
  run
};
