import { db, EndpointError } from 'sdk';
import { and, asc, eq, inArray } from 'sdk/db';
import { cartItems, carts, customers, products } from '../schema.js';

const MAX_CART_LINES = 50;

async function ensureCustomerCart(telegramUserId) {
  const customer = await db.select({ id: customers.id }).from(customers)
    .where(eq(customers.telegramUserId, String(telegramUserId))).get();
  if (!customer) throw new EndpointError('Your PRIME account is not ready yet.', { code: 'ACCOUNT_REQUIRED' });

  await db.insert(carts).values({ customerId: customer.id })
    .onConflictDoNothing({ target: carts.customerId }).run();
  const cart = await db.select().from(carts).where(eq(carts.customerId, customer.id)).get();
  if (!cart) throw new Error('Unable to load customer cart.');
  return cart;
}

async function presentCart(cart) {
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt)).limit(MAX_CART_LINES).all();
  if (lines.length === 0) return { cartId: cart.id, items: [], subtotalMinor: 0, currency: 'PHP' };

  const productRows = await db.select({
    id: products.id,
    sku: products.sku,
    name: products.name,
    priceMinor: products.priceMinor,
    currency: products.currency,
    category: products.category,
    weightGrams: products.weightGrams,
    onHand: products.onHand,
    reserved: products.reserved,
    isActive: products.isActive,
  }).from(products).where(inArray(products.id, lines.map((line) => line.productId))).all();
  const byId = new Map(productRows.map((product) => [product.id, product]));
  let subtotalMinor = 0;
  const items = lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product) return { productId: line.productId, quantity: line.quantity, product: null, lineTotalMinor: 0 };
    const availableStock = Math.max(0, product.onHand - product.reserved);
    const lineTotalMinor = product.isActive ? product.priceMinor * line.quantity : 0;
    subtotalMinor += lineTotalMinor;
    return {
      productId: line.productId,
      quantity: line.quantity,
      lineTotalMinor,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        priceMinor: product.priceMinor,
        currency: product.currency,
        category: product.category,
        weightGrams: product.weightGrams,
        availableStock,
        isActive: product.isActive,
      },
    };
  });
  return { cartId: cart.id, items, subtotalMinor, currency: 'PHP' };
}

export async function getCustomerCart(telegramUserId) {
  const cart = await ensureCustomerCart(telegramUserId);
  return presentCart(cart);
}

export async function setCustomerCartQuantity(telegramUserId, productId, quantity) {
  if (typeof productId !== 'string' || !/^[a-f0-9-]{36}$/i.test(productId)
    || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new EndpointError('Choose a valid product and quantity.', { code: 'INVALID_CART_ITEM' });
  }
  const cart = await ensureCustomerCart(telegramUserId);
  const existing = await db.select({ id: cartItems.id }).from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))).get();

  if (quantity === 0) {
    if (existing) await db.delete(cartItems).where(eq(cartItems.id, existing.id)).run();
    return presentCart(cart);
  }

  const product = await db.select({
    id: products.id,
    onHand: products.onHand,
    reserved: products.reserved,
    isActive: products.isActive,
  }).from(products).where(eq(products.id, productId)).get();
  if (!product?.isActive) throw new EndpointError('This product is no longer available.', { code: 'PRODUCT_UNAVAILABLE' });
  const available = Math.max(0, product.onHand - product.reserved);
  if (quantity > available) throw new EndpointError('There is not enough stock for that quantity.', { code: 'OUT_OF_STOCK', available });

  if (!existing) {
    const lines = await db.select({ id: cartItems.id }).from(cartItems)
      .where(eq(cartItems.cartId, cart.id)).limit(MAX_CART_LINES).all();
    if (lines.length >= MAX_CART_LINES) {
      throw new EndpointError('Your cart has reached its item limit.', { code: 'CART_LIMIT', limit: MAX_CART_LINES });
    }
  }

  await db.insert(cartItems).values({ cartId: cart.id, productId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) },
    }).run();
  return presentCart(cart);
}
