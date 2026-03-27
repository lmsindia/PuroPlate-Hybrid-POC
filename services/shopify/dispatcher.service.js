const ordersPaidHandler = require("./handlers/ordersPaid.handler");

exports.dispatch = async (topic, payload, meta = {}) => {
  const handlerMeta = {
    ...meta,
    topic
  };

  switch (topic) {
    case "orders/paid":
      //return ordersPaidHandler(payload, handlerMeta);
    case "orders/create":
      return ordersPaidHandler(payload, handlerMeta);

    default:
      console.log("Unhandled webhook topic:", topic);
  }
};
