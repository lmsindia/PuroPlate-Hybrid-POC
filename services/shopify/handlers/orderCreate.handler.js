module.exports = async function handleOrdersCreate(order) {
  console.log("Order created (not paid):", order.id);

  // Optional:
  // - Pre-log order
  // - DO NOT deduct inventory
};