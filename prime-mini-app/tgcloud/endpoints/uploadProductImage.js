import { db, EndpointError } from 'sdk';
import { fetch } from 'sdk/fetch';
import { eq } from 'sdk/db';
import { auditEvents, products } from '../schema.js';
import { requireAdmin } from '../lib/security.js';
import { getProductStorageConfig, publicProductImageUrl } from '../lib/productStorage.js';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MIME_EXTENSIONS = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

function validFile(bytes, mimeType) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MAX_FILE_BYTES) return false;
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return mimeType === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

export default async function (input, ctx) {
  const admin = await requireAdmin(ctx);
  const productId = input?.productId;
  if (typeof productId !== 'string' || !/^[a-f0-9-]{36}$/i.test(productId)) {
    throw new EndpointError('Choose a valid product before uploading an image.', { code: 'INVALID_PRODUCT' });
  }
  const product = await db.select({ id: products.id, imagePath: products.imagePath }).from(products).where(eq(products.id, productId)).get();
  if (!product) throw new EndpointError('Product was not found.', { code: 'PRODUCT_NOT_FOUND' });

  const config = await getProductStorageConfig();
  if (!config) throw new EndpointError('Product image storage has not been configured.', { code: 'STORAGE_NOT_CONFIGURED' });
  const mimeType = String(input?.mimeType || '').toLowerCase();
  const encoded = String(input?.dataBase64 || '');
  if (!MIME_EXTENSIONS.has(mimeType) || !encoded
    || encoded.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new EndpointError('Choose a JPEG, PNG, or WebP image up to 4 MB.', { code: 'INVALID_IMAGE' });
  }
  let bytes;
  try {
    const binary = atob(encoded);
    if (!binary.length || binary.length > MAX_FILE_BYTES) throw new Error('invalid image size');
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new EndpointError('The image is invalid or exceeds 4 MB.', { code: 'INVALID_IMAGE' });
  }
  if (!validFile(bytes, mimeType)) throw new EndpointError('The file content does not match its image type.', { code: 'INVALID_IMAGE' });
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');

  const id = crypto.randomUUID();
  const storagePath = `product-images/${id}.${MIME_EXTENSIONS.get(mimeType)}`;
  const objectPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.productBucket)}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!response.ok) throw new EndpointError('Product image storage is unavailable.', { code: 'IMAGE_UPLOAD_FAILED' });

  const imageUrl = publicProductImageUrl(config, storagePath);
  const updated = await db.update(products)
    .set({ imagePath: storagePath, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) })
    .where(eq(products.id, productId)).returning({ id: products.id, imagePath: products.imagePath }).run();
  if (!updated[0]) throw new EndpointError('Product image was uploaded, but the product could not be updated.', { code: 'PRODUCT_UPDATE_FAILED' });
  await db.insert(auditEvents).values({
    actorAdminId: admin.id,
    action: 'product.image_uploaded',
    entityType: 'product',
    entityId: productId,
    beforeState: { imagePath: product.imagePath },
    afterState: { imagePath: storagePath, contentType: mimeType, sizeBytes: bytes.length, sha256 },
  }).run();
  return { storagePath, imageUrl, contentType: mimeType, sizeBytes: bytes.length, sha256 };
}
