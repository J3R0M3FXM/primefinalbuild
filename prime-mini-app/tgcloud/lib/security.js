import { EndpointError } from 'sdk';

export function requireCustomer(ctx) {
  const user = ctx?.initData?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new EndpointError('Telegram account could not be verified.', { code: 'UNAUTHENTICATED' });
  }
  return user;
}

export function requireAdmin(user, configuredTelegramIds) {
  if (!Array.isArray(configuredTelegramIds) || configuredTelegramIds.length === 0) {
    throw new EndpointError('Admin access is not configured.', { code: 'ADMIN_NOT_CONFIGURED' });
  }
  const id = String(user?.id ?? '');
  if (!/^\d+$/.test(id) || !configuredTelegramIds.includes(id)) {
    throw new EndpointError('You are not authorized to use PRIME administration.', { code: 'FORBIDDEN' });
  }
  return user;
}

export function validateIdempotencyKey(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}
