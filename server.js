require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");
const { validateEnv } = require("./config/env");
const { normalizeHttpError } = require("./utils/errorMapping");
const logger = require("./utils/logger");

const products = require("./routes/products");
const checkout = require("./routes/checkout");
const webhook = require("./routes/shopifyWebhook");
const vendors = require("./routes/vendors");

validateEnv();

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  req.log = logger.withRequestId(requestId);
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.info("request.completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  next();
});

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use("/api/products", products);
app.use("/api/checkout", checkout);
app.use("/api/vendors", vendors);
app.use("/webhooks/shopify", webhook);

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    requestId: req.requestId
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const { statusCode, clientMessage } = normalizeHttpError(err);

  logger.error("request.failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorCode: err.code,
    error: err.message,
    detail: err.detail,
    stack: statusCode >= 500 ? err.stack : undefined
  });

  res.status(statusCode).json({
    error: clientMessage,
    requestId: req.requestId
  });
});

app.listen(process.env.PORT, () => {
  logger.info("server.started", {
    port: Number(process.env.PORT)
  });
});

