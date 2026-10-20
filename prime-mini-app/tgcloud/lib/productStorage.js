import { db } from 'sdk';
import { eq } from 'sdk/db';
import { systemSettings } from '../schema.js';

export async function getProductStorageConfig() {
  const row = await db.select({ value: systemSettings.value }).from(systemSettings)
    .where(eq(systemSettings.key, 'supabase_storage_config')).get();
  const value = row?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const urlMatch = typeof value.url === 'string'
      ? value.url.match(/^https:\/\/([a-z0-9-]+\.supabase\.co)\/?$/i)
      : null;
    if (!urlMatch
      || typeof value.serviceRoleKey !== 'string' || value.serviceRoleKey.length < 20
      || typeof value.productBucket !== 'string' || !/^[a-zA-Z0-9_-]{1,63}$/.test(value.productBucket)
      || typeof value.paymentProofBucket !== 'string' || !/^[a-zA-Z0-9_-]{1,63}$/.test(value.paymentProofBucket)
      || value.productBucket === value.paymentProofBucket) return null;
    return {
      url: `https://${urlMatch[1].toLowerCase()}`,
      serviceRoleKey: value.serviceRoleKey,
      productBucket: value.productBucket,
      paymentProofBucket: value.paymentProofBucket,
    };
  } catch {
    return null;
  }
}

export function publicProductImageUrl(config, path) {
  if (!config || typeof path !== 'string' || !/^product-images\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(path)) return null;
  const objectPath = path.split('/').map(encodeURIComponent).join('/');
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.productBucket)}/${objectPath}`;
}
