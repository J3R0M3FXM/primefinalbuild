import { db } from 'sdk';
import { eq } from 'sdk/db';
import { systemSettings } from '../schema.js';

export async function getProductStorageConfig() {
  const row = await db.select({ value: systemSettings.value }).from(systemSettings)
    .where(eq(systemSettings.key, 'supabase_storage_config')).get();
  const value = row?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
      || url.pathname !== '/' || url.search || url.hash
      || typeof value.serviceRoleKey !== 'string' || value.serviceRoleKey.length < 20
      || typeof value.productBucket !== 'string' || !/^[a-z0-9_-]{1,63}$/.test(value.productBucket)) return null;
    return { url: url.origin, serviceRoleKey: value.serviceRoleKey, productBucket: value.productBucket };
  } catch {
    return null;
  }
}

export function publicProductImageUrl(config, path) {
  if (!config || typeof path !== 'string' || !/^product-images\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(path)) return null;
  const objectPath = path.split('/').map(encodeURIComponent).join('/');
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.productBucket)}/${objectPath}`;
}
