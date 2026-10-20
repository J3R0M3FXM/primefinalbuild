import { db } from 'sdk';
import { asc, eq } from 'sdk/db';
import { products } from '../schema.js';
import { getProductStorageConfig, publicProductImageUrl } from '../lib/productStorage.js';

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
    imagePath: products.imagePath,
    onHand: products.onHand,
    reserved: products.reserved,
  }).from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.category), asc(products.name))
    .all();

  const storageConfig = await getProductStorageConfig();
  return rows.map(({ onHand, reserved, imagePath, ...product }) => ({
    ...product,
    imageUrl: publicProductImageUrl(storageConfig, imagePath),
    availableStock: Math.max(0, onHand - reserved),
  }));
}
