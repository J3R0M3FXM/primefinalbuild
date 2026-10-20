import { check, index, integer, real, sql, table, text, uniqueIndex } from 'sdk/db';

const uuidDefault = () => sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))))`;
const createdAt = () => integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);

export const customers = table('customers', {
  id: text('id').primaryKey().default(uuidDefault()),
  telegramUserId: text('telegram_user_id').notNull(),
  memberId: text('member_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  username: text('username'),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({
  telegramUserIdUnique: uniqueIndex('customers_telegram_user_id_uidx').on(t.telegramUserId),
  memberIdUnique: uniqueIndex('customers_member_id_uidx').on(t.memberId),
  usernameLookup: index('customers_username_idx').on(t.username),
}));

export const products = table('products', {
  id: text('id').primaryKey().default(uuidDefault()),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  productType: text('product_type').notNull().default('PHYSICAL'),
  priceMinor: integer('price_minor').notNull(),
  currency: text('currency').notNull().default('PHP'),
  category: text('category'),
  imagePath: text('image_path'),
  weightGrams: integer('weight_grams'),
  dimensionsCm: text('dimensions_cm', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }).notNull().default({}),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({
  skuUnique: uniqueIndex('products_sku_uidx').on(t.sku),
  activeCategory: index('products_active_category_idx').on(t.isActive, t.category),
  priceNonnegative: check('products_price_nonnegative_check', sql`${t.priceMinor} >= 0`),
  inventoryNonnegative: check('products_inventory_nonnegative_check', sql`${t.onHand} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.onHand}`),
  weightNonnegative: check('products_weight_nonnegative_check', sql`${t.weightGrams} IS NULL OR ${t.weightGrams} >= 0`),
}));

export const carts = table('carts', {
  id: text('id').primaryKey().default(uuidDefault()),
  customerId: text('customer_id').notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({ customerUnique: uniqueIndex('carts_customer_uidx').on(t.customerId) }));

export const cartItems = table('cart_items', {
  id: text('id').primaryKey().default(uuidDefault()),
  cartId: text('cart_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({
  cartProductUnique: uniqueIndex('cart_items_cart_product_uidx').on(t.cartId, t.productId),
  cartLookup: index('cart_items_cart_idx').on(t.cartId),
  quantityPositive: check('cart_items_quantity_positive_check', sql`${t.quantity} > 0 AND ${t.quantity} <= 99`),
}));

// Relationships use plain IDs because Telegram Serverless SQLite does not
// enforce foreign keys. Endpoints validate ownership and parent records.
export const customerAddresses = table('customer_addresses', {
  id: text('id').primaryKey().default(uuidDefault()),
  customerId: text('customer_id').notNull(),
  label: text('label'),
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  formattedAddress: text('formatted_address').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  placeId: text('place_id'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({ customerLookup: index('customer_addresses_customer_idx').on(t.customerId) }));

export const orders = table('orders', {
  id: text('id').primaryKey().default(uuidDefault()),
  orderNumber: text('order_number').notNull(),
  customerId: text('customer_id').notNull(),
  status: text('status').notNull().default('AWAITING_PAYMENT'),
  paymentStatus: text('payment_status').notNull().default('PENDING'),
  subtotalMinor: integer('subtotal_minor').notNull(),
  shippingMinor: integer('shipping_minor').notNull(),
  discountMinor: integer('discount_minor').notNull().default(0),
  totalMinor: integer('total_minor').notNull(),
  currency: text('currency').notNull().default('PHP'),
  addressSnapshot: text('address_snapshot', { mode: 'json' }).notNull(),
  shippingSnapshot: text('shipping_snapshot', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({
  orderNumberUnique: uniqueIndex('orders_order_number_uidx').on(t.orderNumber),
  customerCreated: index('orders_customer_created_idx').on(t.customerId, t.createdAt),
  expiryLookup: index('orders_expiry_lookup_idx').on(t.status, t.expiresAt),
  amountsNonnegative: check('orders_amounts_nonnegative_check', sql`${t.subtotalMinor} >= 0 AND ${t.shippingMinor} >= 0 AND ${t.discountMinor} >= 0 AND ${t.totalMinor} >= 0`),
}));

export const orderItems = table('order_items', {
  id: text('id').primaryKey().default(uuidDefault()),
  orderId: text('order_id').notNull(),
  productId: text('product_id').notNull(),
  skuSnapshot: text('sku_snapshot').notNull(),
  nameSnapshot: text('name_snapshot').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalMinor: integer('line_total_minor').notNull(),
  createdAt: createdAt(),
}, (t) => ({
  orderLookup: index('order_items_order_idx').on(t.orderId),
  quantityPositive: check('order_items_quantity_positive_check', sql`${t.quantity} > 0`),
  amountsNonnegative: check('order_items_amounts_nonnegative_check', sql`${t.unitPriceMinor} >= 0 AND ${t.lineTotalMinor} >= 0`),
}));

export const payments = table('payments', {
  id: text('id').primaryKey().default(uuidDefault()),
  orderId: text('order_id').notNull(),
  method: text('method').notNull().default('MANUAL_QR'),
  status: text('status').notNull().default('PENDING'),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull().default('PHP'),
  reference: text('reference'),
  customerNote: text('customer_note'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  verifiedAt: integer('verified_at', { mode: 'timestamp' }),
  verifiedBy: text('verified_by'),
  rejectionReason: text('rejection_reason'),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({ orderLookup: index('payments_order_idx').on(t.orderId), statusQueue: index('payments_status_created_idx').on(t.status, t.createdAt) }));

export const paymentProofs = table('payment_proofs', {
  id: text('id').primaryKey().default(uuidDefault()),
  paymentId: text('payment_id').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksum: text('checksum'),
  createdAt: createdAt(),
}, (t) => ({ paymentLookup: index('payment_proofs_payment_idx').on(t.paymentId), sizePositive: check('payment_proofs_size_positive_check', sql`${t.sizeBytes} > 0`) }));

export const inventoryTransactions = table('inventory_transactions', {
  id: text('id').primaryKey().default(uuidDefault()),
  productId: text('product_id').notNull(),
  orderId: text('order_id'),
  kind: text('kind').notNull(),
  quantityDelta: integer('quantity_delta').notNull(),
  reason: text('reason'),
  actorCustomerId: text('actor_customer_id'),
  createdAt: createdAt(),
}, (t) => ({ productHistory: index('inventory_transactions_product_created_idx').on(t.productId, t.createdAt), orderLookup: index('inventory_transactions_order_idx').on(t.orderId) }));

export const shippingServices = table('shipping_services', {
  id: text('id').primaryKey().default(uuidDefault()),
  courierName: text('courier_name').notNull(),
  serviceName: text('service_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  maxDistanceMeters: integer('max_distance_meters'),
  maxWeightGrams: integer('max_weight_grams'),
  pricingRules: text('pricing_rules', { mode: 'json' }).notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => ({ activeLookup: index('shipping_services_active_idx').on(t.isActive) }));

export const auditEvents = table('audit_events', {
  id: text('id').primaryKey().default(uuidDefault()),
  actorCustomerId: text('actor_customer_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeState: text('before_state', { mode: 'json' }),
  afterState: text('after_state', { mode: 'json' }),
  reason: text('reason'),
  createdAt: createdAt(),
}, (t) => ({ entityHistory: index('audit_events_entity_created_idx').on(t.entityType, t.entityId, t.createdAt) }));
