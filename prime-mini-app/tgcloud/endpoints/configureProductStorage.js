import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { systemSettings } from '../schema.js';
import { requireAdmin } from '../lib/security.js';
import { getProductStorageConfig } from '../lib/productStorage.js';

export default async function (input, ctx) {
  await requireAdmin(ctx);
  if (input?.action === 'status') {
    const config = await getProductStorageConfig();
    return {
      configured: Boolean(config),
      productBucket: config?.productBucket ?? null,
      paymentProofBucket: config?.paymentProofBucket ?? null,
    };
  }
  if (input?.action !== 'configure') {
    throw new EndpointError('Choose a supported storage configuration action.', { code: 'INVALID_ACTION' });
  }

  const rawUrl = typeof input.url === 'string' ? input.url.trim() : '';
  const productBucket = typeof input.productBucket === 'string' ? input.productBucket.trim() : '';
  const paymentProofBucket = typeof input.paymentProofBucket === 'string' ? input.paymentProofBucket.trim() : '';
  const serviceRoleKey = typeof input.serviceRoleKey === 'string' ? input.serviceRoleKey.trim() : '';
  const urlMatch = rawUrl.match(/^https:\/\/([a-z0-9-]+\.supabase\.co)\/?$/i);
  if (!urlMatch
    || !/^[a-zA-Z0-9_-]{1,63}$/.test(productBucket)
    || !/^[a-zA-Z0-9_-]{1,63}$/.test(paymentProofBucket)
    || productBucket === paymentProofBucket || serviceRoleKey.length < 20) {
    throw new EndpointError('Provide a standard Supabase project URL, separate product and payment-proof buckets, and a server Storage key.', { code: 'INVALID_STORAGE_CONFIG' });
  }

  const url = `https://${urlMatch[1].toLowerCase()}`;
  const value = { url, serviceRoleKey, productBucket, paymentProofBucket };
  await db.insert(systemSettings).values({
    key: 'supabase_storage_config',
    value,
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) },
  }).run();

  return { configured: true, productBucket, paymentProofBucket };
}
