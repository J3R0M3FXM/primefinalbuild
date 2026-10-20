import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { systemSettings } from '../schema.js';

export function requireCustomer(ctx) {
  const user = ctx?.initData?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new EndpointError('Telegram account could not be verified.', { code: 'UNAUTHENTICATED' });
  }
  return user;
}

export async function requireAdmin(ctx) {
  const user = ctx?.initData?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new EndpointError('Telegram account could not be verified.', { code: 'UNAUTHENTICATED' });
  }
  const row = await db.select({ value: systemSettings.value }).from(systemSettings)
    .where(eq(systemSettings.key, 'admin_telegram_user_id')).get();
  const value = row?.value;
  const candidates = Array.isArray(value) ? value
    : value && typeof value === 'object' ? [value]
      : [value];
  const allowedIds = candidates.map((candidate) => {
    const id = candidate && typeof candidate === 'object' ? candidate.userId : candidate;
    return typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '';
  }).filter((id) => /^\d+$/.test(id));
  const telegramUserId = String(user.id);
  if (!allowedIds.includes(telegramUserId)) {
    throw new EndpointError('You are not authorized to use PRIME administration.', { code: 'FORBIDDEN' });
  }
  return { id: telegramUserId, role: 'OWNER', telegramUserId };
}

export function validateIdempotencyKey(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}
