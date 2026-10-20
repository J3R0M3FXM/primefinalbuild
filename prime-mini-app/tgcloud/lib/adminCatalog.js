import { db, EndpointError } from 'sdk';
import { and, asc, eq, sql } from 'sdk/db';
import { auditEvents, inventoryTransactions, products } from '../schema.js';

const MAX_PRICE_MINOR = 100_000_000;
const MAX_STOCK_DELTA = 100_000;

function invalid(message = 'Product details are invalid.') {
  throw new EndpointError(message, { code: 'INVALID_PRODUCT' });
}

function normalizeProduct(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const sku = typeof input.sku === 'string' ? input.sku.trim().toUpperCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const description = input.description == null ? null : typeof input.description === 'string' ? input.description.trim() : undefined;
  const category = input.category == null ? null : typeof input.category === 'string' ? input.category.trim() : undefined;
  const weightGrams = input.weightGrams == null ? null : input.weightGrams;
  const rawDimensions = input.dimensionsCm == null ? null : input.dimensionsCm;
  const dimensionsCm = rawDimensions == null ? null : {
    length: rawDimensions.length,
    width: rawDimensions.width,
    height: rawDimensions.height,
  };
  const imagePath = input.imagePath;
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku) || name.length < 1 || name.length > 160
    || description === undefined || description?.length > 5000
    || category === undefined || category?.length > 100
    || !Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0 || input.priceMinor > MAX_PRICE_MINOR
    || (weightGrams !== null && (!Number.isSafeInteger(weightGrams) || weightGrams < 0 || weightGrams > 1_000_000))
    || (rawDimensions !== null && (!rawDimensions || typeof rawDimensions !== 'object' || Array.isArray(rawDimensions)
      || ['length', 'width', 'height'].some((key) => !Number.isFinite(rawDimensions[key]) || rawDimensions[key] <= 0 || rawDimensions[key] > 500)))
    || (imagePath !== undefined && imagePath !== null && (typeof imagePath !== 'string'
      || !/^product-images\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(imagePath)))
    || typeof input.isActive !== 'boolean' || (input.productType !== undefined && input.productType !== 'PHYSICAL')) invalid();

  const values = {
    sku, name, description, priceMinor: input.priceMinor, currency: 'PHP',
    category: category || null, weightGrams, dimensionsCm, productType: 'PHYSICAL', isActive: input.isActive,
  };
  if (imagePath !== undefined) values.imagePath = imagePath;
  return values;
}

function publicAdminProduct(row) {
  const { imagePath, ...product } = row;
  return { ...product, hasImage: Boolean(imagePath) };
}

export async function listAdminProducts() {
  const rows = await db.select().from(products).orderBy(asc(products.category), asc(products.name)).all();
  return rows.map(publicAdminProduct);
}

export async function saveAdminProduct(admin, input) {
  const values = normalizeProduct(input);
  const id = input.id;
  if (id !== undefined && (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))) invalid();

  let before = null;
  let saved;
  if (id) {
    before = await db.select().from(products).where(eq(products.id, id)).get();
    if (!before) throw new EndpointError('Product was not found.', { code: 'PRODUCT_NOT_FOUND' });
    const rows = await db.update(products).set({ ...values, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) })
      .where(eq(products.id, id)).returning().run();
    saved = rows[0];
  } else {
    const rows = await db.insert(products).values(values).returning().run();
    saved = rows[0];
  }

  if (!saved) throw new Error('Product update could not be confirmed.');
  await db.insert(auditEvents).values({
    actorAdminId: admin.id,
    action: before ? 'product.updated' : 'product.created',
    entityType: 'product',
    entityId: saved.id,
    beforeState: before ? publicAdminProduct(before) : null,
    afterState: publicAdminProduct(saved),
  }).run();
  return publicAdminProduct(saved);
}

export async function adjustAdminInventory(admin, input) {
  const id = input?.productId;
  const delta = input?.delta;
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)
    || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > MAX_STOCK_DELTA
    || reason.length < 3 || reason.length > 300) {
    throw new EndpointError('Provide a product, a valid stock adjustment, and a reason.', { code: 'INVALID_INVENTORY_ADJUSTMENT' });
  }

  const before = await db.select({ id: products.id, onHand: products.onHand, reserved: products.reserved })
    .from(products).where(eq(products.id, id)).get();
  if (!before) throw new EndpointError('Product was not found.', { code: 'PRODUCT_NOT_FOUND' });

  const rows = await db.update(products)
    .set({ onHand: sql`${products.onHand} + ${delta}`, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) })
    .where(and(
      eq(products.id, id),
      sql`${products.onHand} + ${delta} >= ${products.reserved}`,
      sql`${products.onHand} + ${delta} >= 0`,
    )).returning({ id: products.id, onHand: products.onHand, reserved: products.reserved }).run();
  const after = rows[0];
  if (!after) {
    throw new EndpointError('That adjustment would reduce stock below the reserved quantity.', { code: 'RESERVED_STOCK_CONFLICT' });
  }

  await db.insert(inventoryTransactions).values({
    productId: id,
    kind: 'ADMIN_ADJUSTMENT',
    quantityDelta: delta,
    reason,
    actorAdminId: admin.id,
  }).run();
  await db.insert(auditEvents).values({
    actorAdminId: admin.id,
    action: 'inventory.adjusted',
    entityType: 'product',
    entityId: id,
    beforeState: before,
    afterState: { ...after, quantityDelta: delta },
    reason,
  }).run();
  return after;
}
