import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { adminUsers } from '../schema.js';

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
  const admin = await db.select({ id: adminUsers.id, role: adminUsers.role, isActive: adminUsers.isActive })
    .from(adminUsers)
    .where(eq(adminUsers.telegramUserId, String(user.id))).get();
  if (!admin) {
    throw new EndpointError('You are not authorized to use PRIME administration.', { code: 'FORBIDDEN' });
  }
  if (!admin.isActive || !['OWNER', 'ADMIN'].includes(admin.role)) {
    throw new EndpointError('You are not authorized to use PRIME administration.', { code: 'FORBIDDEN' });
  }
  return { id: admin.id, role: admin.role, telegramUserId: String(user.id) };
}

export function validateIdempotencyKey(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}
