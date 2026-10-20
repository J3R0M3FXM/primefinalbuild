const MAX_PROOF_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function config(baseUrl, serviceKey, bucket, path) {
  if (typeof baseUrl !== 'string' || !/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl)) {
    throw new TypeError('Supabase Storage server configuration is invalid.');
  }
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) {
    throw new TypeError('Supabase Storage server configuration is missing.');
  }
  if (typeof bucket !== 'string' || !/^[a-zA-Z0-9_-]{1,63}$/.test(bucket)) throw new TypeError('Invalid storage bucket.');
  if (typeof path !== 'string' || path.length > 512 || path.startsWith('/')
    || path.split('/').some((segment) => !segment || segment === '.' || segment === '..' || !/^[a-zA-Z0-9_.-]+$/.test(segment))) {
    throw new TypeError('Invalid storage object path.');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), serviceKey, bucket, path };
}

function headers(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra };
}

export function validatePaymentProof(bytes, mimeType) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12 || bytes.byteLength > MAX_PROOF_BYTES
    || !ALLOWED_PROOF_TYPES.has(mimeType)) return false;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return (mimeType === 'image/jpeg' && isJpeg) || (mimeType === 'image/png' && isPng)
    || (mimeType === 'image/webp' && isWebp);
}

export async function createPaymentProofUploadUrl({ fetch, baseUrl, serviceKey, bucket, paymentId, randomId, mimeType, sizeBytes }) {
  if (!/^[a-f0-9-]{36}$/i.test(paymentId) || !/^[a-f0-9-]{36}$/i.test(randomId)
    || !ALLOWED_PROOF_TYPES.has(mimeType) || !Number.isSafeInteger(sizeBytes)
    || sizeBytes < 12 || sizeBytes > MAX_PROOF_BYTES) {
    throw new TypeError('Payment proof upload request is invalid.');
  }
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const path = `payment-proofs/${paymentId}/${randomId}.${extension}`;
  const target = config(baseUrl, serviceKey, bucket, path);
  const objectPath = target.path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${target.baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${objectPath}`, {
    method: 'POST',
    headers: headers(serviceKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ upsert: false }),
  });
  if (!response.ok) throw new Error('Payment proof storage is unavailable.');
  const result = await response.json();
  const signedPath = result?.signedURL || result?.signedUrl;
  if (typeof signedPath !== 'string' || !signedPath.startsWith('/object/upload/sign/')) {
    throw new Error('Payment proof storage is unavailable.');
  }
  return { storagePath: path, signedUploadUrl: `${target.baseUrl}/storage/v1${signedPath}`, mimeType, sizeBytes };
}

export async function uploadPaymentProof({ fetch, baseUrl, serviceKey, bucket, path, bytes, mimeType }) {
  const target = config(baseUrl, serviceKey, bucket, path);
  if (!path.startsWith('payment-proofs/') || !validatePaymentProof(bytes, mimeType)) {
    throw new TypeError('Payment proof file is invalid.');
  }
  const objectPath = target.path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${target.baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
    method: 'POST',
    headers: headers(serviceKey, { 'Content-Type': mimeType, 'x-upsert': 'false' }),
    body: bytes,
  });
  if (!response.ok) throw new Error('Payment proof storage is unavailable.');
  return { storagePath: path, mimeType, sizeBytes: bytes.byteLength };
}

export async function createPrivateReadUrl({ fetch, baseUrl, serviceKey, bucket, path, expiresIn = 300 }) {
  const target = config(baseUrl, serviceKey, bucket, path);
  if (!Number.isInteger(expiresIn) || expiresIn < 30 || expiresIn > 3600) throw new TypeError('Invalid signed URL duration.');
  const objectPath = target.path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${target.baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectPath}`, {
    method: 'POST',
    headers: headers(serviceKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error('Private file access is unavailable.');
  const result = await response.json();
  if (typeof result?.signedURL !== 'string' || !result.signedURL.startsWith('/object/sign/')) {
    throw new Error('Private file access is unavailable.');
  }
  return `${target.baseUrl}/storage/v1${result.signedURL}`;
}
