require("dotenv").config();

const STORE = process.env.SHOPIFY_STORE;
const MAX_CART_LINES = 25;
const MAX_LINE_QUANTITY = 20;

function normalizeVariantId(variantId) {
  if (variantId === undefined || variantId === null) {
    throw new Error("Each item must include a variantId");
  }

  let normalizedVariantId = String(variantId).trim();

  if (!normalizedVariantId) {
    throw new Error("variantId cannot be empty");
  }

  if (normalizedVariantId.startsWith("gid://shopify/ProductVariant/")) {
    normalizedVariantId = normalizedVariantId.replace(
      "gid://shopify/ProductVariant/",
      ""
    );
  }

  if (!/^\d+$/.test(normalizedVariantId)) {
    throw new Error(`Invalid variantId: ${variantId}`);
  }

  return normalizedVariantId;
}

function normalizeQuantity(quantity) {
  const normalizedQuantity = Number(quantity);

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  if (normalizedQuantity > MAX_LINE_QUANTITY) {
    throw new Error(
      `Quantity cannot exceed ${MAX_LINE_QUANTITY} per variant`
    );
  }

  return normalizedQuantity;
}

function sanitizeCheckoutItems(items) {

  if (!Array.isArray(items) || !items.length) {
    throw new Error("Cart empty");
  }

  if (items.length > MAX_CART_LINES) {
    throw new Error(`Cart cannot contain more than ${MAX_CART_LINES} items`);
  }

  const mergedItems = new Map();

  for (const item of items) {
    const variantId = normalizeVariantId(item?.variantId);
    const quantity = normalizeQuantity(item?.quantity);
    const nextQuantity = (mergedItems.get(variantId) || 0) + quantity;

    if (nextQuantity > MAX_LINE_QUANTITY) {
      throw new Error(
        `Quantity cannot exceed ${MAX_LINE_QUANTITY} per variant`
      );
    }

    mergedItems.set(variantId, nextQuantity);
  }

  return Array.from(mergedItems.entries()).map(([variantId, quantity]) => ({
    variantId,
    quantity
  }));

}

function createCheckout(items) {
  const validItems = sanitizeCheckoutItems(items);

  if (!STORE) {
    throw new Error("SHOPIFY_STORE is not configured");
  }

  const cartString = validItems
    .map(item => `${item.variantId}:${item.quantity}`)
    .join(",");

  return `https://${STORE}/cart/${cartString}?checkout`;
}

module.exports = {
  createCheckout,
  normalizeVariantId,
  sanitizeCheckoutItems
};
