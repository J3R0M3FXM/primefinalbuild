// Pure calculation from catalog rows fetched on the server. Call only after the
// quote is revalidated, and persist its returned snapshots within the same
// verified atomic stock reservation operation.
export function calculateOrderTotals({ requestedItems, catalogById, shippingQuote, discountMinor = 0 }) {
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 50
    || !(catalogById instanceof Map) || !shippingQuote?.available
    || !Number.isSafeInteger(shippingQuote.totalMinor) || shippingQuote.totalMinor < 0
    || !Number.isSafeInteger(discountMinor) || discountMinor < 0) {
    return { ok: false, reason: 'INVALID_ORDER' };
  }

  const seen = new Set();
  const items = [];
  let subtotalMinor = 0;
  let totalQuantity = 0;
  for (const requested of requestedItems) {
    const id = requested?.productId;
    const quantity = requested?.quantity;
    if (typeof id !== 'string' || !id || seen.has(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, reason: 'INVALID_ITEM' };
    }
    seen.add(id);
    totalQuantity += quantity;
    if (totalQuantity > 99) return { ok: false, reason: 'QUANTITY_LIMIT' };

    const product = catalogById.get(id);
    if (!product?.isActive) return { ok: false, reason: 'PRODUCT_UNAVAILABLE', productId: id };
    const available = product.onHand - product.reserved;
    if (!Number.isSafeInteger(available) || available < quantity) return { ok: false, reason: 'OUT_OF_STOCK', productId: id };
    if (!Number.isSafeInteger(product.priceMinor) || product.priceMinor < 0) return { ok: false, reason: 'INVALID_CATALOG_PRICE' };

    const lineTotalMinor = product.priceMinor * quantity;
    if (!Number.isSafeInteger(lineTotalMinor)) return { ok: false, reason: 'PRICE_OVERFLOW' };
    subtotalMinor += lineTotalMinor;
    if (!Number.isSafeInteger(subtotalMinor)) return { ok: false, reason: 'PRICE_OVERFLOW' };
    items.push({
      productId: product.id,
      skuSnapshot: product.sku,
      nameSnapshot: product.name,
      unitPriceMinor: product.priceMinor,
      quantity,
      lineTotalMinor,
    });
  }

  if (discountMinor > subtotalMinor + shippingQuote.totalMinor) return { ok: false, reason: 'INVALID_DISCOUNT' };
  const totalMinor = subtotalMinor + shippingQuote.totalMinor - discountMinor;
  if (!Number.isSafeInteger(totalMinor)) return { ok: false, reason: 'PRICE_OVERFLOW' };
  return {
    ok: true,
    items,
    subtotalMinor,
    shippingMinor: shippingQuote.totalMinor,
    discountMinor,
    totalMinor,
    currency: 'PHP',
  };
}
