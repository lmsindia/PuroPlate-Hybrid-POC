const crypto = require("crypto");

function getWebhookRawBody(req) {
  if (typeof req.rawBody === "string" || Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }

  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
    return req.body;
  }

  return null;
}

function verifyShopifyWebhook(req) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  const rawBody = getWebhookRawBody(req);

  if (!hmacHeader || rawBody === null) return false;

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);

  if (digestBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

module.exports = verifyShopifyWebhook;
module.exports.getWebhookRawBody = getWebhookRawBody;
