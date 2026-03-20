const SERVICE_UNAVAILABLE_ERROR_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "57P01",
  "57P02",
  "57P03",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT"
]);

function normalizeHttpError(err) {
  if (err?.statusCode) {
    return {
      statusCode: err.statusCode,
      clientMessage:
        err.statusCode >= 500 ? "Internal server error" : err.message
    };
  }

  if (SERVICE_UNAVAILABLE_ERROR_CODES.has(err?.code)) {
    return {
      statusCode: 503,
      clientMessage: "Service unavailable"
    };
  }

  return {
    statusCode: 500,
    clientMessage: "Internal server error"
  };
}

module.exports = {
  normalizeHttpError
};
