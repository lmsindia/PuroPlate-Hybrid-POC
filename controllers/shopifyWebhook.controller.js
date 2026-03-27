const dispatcher = require("../services/shopify/dispatcher.service");
const verifyWebhook = require("../utils/verifyWebhook");
const { getWebhookRawBody } = verifyWebhook;

exports.handleWebhook = async (req, res) => {
  try {
    if (!verifyWebhook(req)) {
      return res.sendStatus(401);
    }

    const topic = req.headers["x-shopify-topic"];
    const webhookId = req.headers["x-shopify-webhook-id"];
    const rawBody = getWebhookRawBody(req);

    if (rawBody === null) {
      return res.sendStatus(400);
    }

    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody
    );

    await dispatcher.dispatch(topic, payload, {
      webhookId
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
};
