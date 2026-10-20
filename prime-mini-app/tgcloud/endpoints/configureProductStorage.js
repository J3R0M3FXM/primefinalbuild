import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { systemSettings } from '../schema.js';
import { requireAdmin } from '../lib/security.js';
import { getProductStorageConfig } from '../lib/productStorage.js';

export default async function (input, ctx) {
  await requireAdmin(ctx);
  if (input?.action === 'status') {
    const config = await getProductStorageConfig();
    return { configured: Boolean(config), productBucket: config?.productBucket ?? null };
  }
  if (input?.action !== 'configure') {
    throw new EndpointError('Choose a supported storage configuration action.', { code: 'INVALID_ACTION' });
  }

  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const productBucket = typeof input.productBucket === 'string' ? input.productBucket.trim() : '';
  const serviceRoleKey = typeof input.serviceRoleKey === 'string' ? input.serviceRoleKey.trim() : '';
  let parsed;
  try { parsed = new URL(url); } catch { parsed = null; }
  if (!parsed || parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)
    || parsed.pathname !== '/' || parsed.search || parsed.hash
    || !/^[a-z0-9_-]{1,63}$/.test(productBucket) || serviceRoleKey.length < 20) {
    throw new EndpointError('Provide a standard Supabase project URL, product bucket, and server Storage key.', { code: 'INVALID_STORAGE_CONFIG' });
  }

  await db.insert(systemSettings).values({
    key: 'supabase_storage_config',
    value: { url: parsed.origin, serviceRoleKey, productBucket },
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value: { url: parsed.origin, serviceRoleKey, productBucket }, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) },
  }).run();

  return { configured: true, productBucket };
}
