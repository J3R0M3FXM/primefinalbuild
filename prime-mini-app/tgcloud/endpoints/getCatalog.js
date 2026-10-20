import { db } from 'sdk';
import { asc, eq } from 'sdk/db';
import { products } from '../schema.js';

export default async function () {
  const rows = await db.select({
    id: products.id,
    sku: products.sku,
    name: products.name,
    description: products.description,
    priceMinor: products.priceMinor,
    currency: products.currency,
    category: products.category,
    weightGrams: products.weightGrams,
    onHand: products.onHand,
    reserved: products.reserved,
  }).from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.category), asc(products.name))
    .all();

  return rows.map(({ onHand, reserved, ...product }) => ({
    ...product,
    // Storage path resolution is added with the Supabase Storage adapter.
    // Do not expose raw object paths as browser URLs or guess a bucket URL.
    imageUrl: null,
    availableStock: Math.max(0, onHand - reserved),
  }));
}
