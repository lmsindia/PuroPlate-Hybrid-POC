const REQUIRED_ENV_VARS = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "SHOPIFY_STORE",
  "SHOPIFY_API_VERSION",
  "SHOPIFY_ACCESS_TOKEN",
  "SHOPIFY_LOCATION_ID",
  "SHOPIFY_WEBHOOK_SECRET"
];

function validateEnv() {
  const missingVars = REQUIRED_ENV_VARS.filter(envVar => {
    const value = process.env[envVar];
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (missingVars.length) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
}

module.exports = {
  REQUIRED_ENV_VARS,
  validateEnv
};
