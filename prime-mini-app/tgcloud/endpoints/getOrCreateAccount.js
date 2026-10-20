import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { customers } from '../schema.js';

const MEMBER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MEMBER_ID_LENGTH = 12;
const MAX_MEMBER_ID_ATTEMPTS = 8;

function memberIdFromHex(hex) {
  let result = '';
  for (let index = 0; index + 1 < hex.length && result.length < MEMBER_ID_LENGTH; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);
    // Reject the top values so modulo mapping has no bias.
    if (byte >= 248) continue;
    result += MEMBER_ALPHABET[byte % MEMBER_ALPHABET.length];
  }
  if (result.length !== MEMBER_ID_LENGTH) throw new Error('Could not generate a member identifier.');
  return result;
}

async function findByTelegramId(telegramUserId) {
  return db.select().from(customers)
    .where(eq(customers.telegramUserId, telegramUserId))
    .get();
}

function publicAccount(customer) {
  return {
    memberId: customer.memberId,
    displayName: customer.firstName,
  };
}

export default async function (_input, ctx) {
  const telegramUser = ctx?.initData?.user;
  if (!telegramUser?.id) throw new Error('A verified Telegram Mini App identity is required.');

  const telegramUserId = String(telegramUser.id);
  const existing = await findByTelegramId(telegramUserId);
  if (existing) return publicAccount(existing);

  const firstName = String(telegramUser.first_name || 'PRIME Member').trim().slice(0, 80) || 'PRIME Member';
  const lastName = String(telegramUser.last_name || '').trim().slice(0, 80) || null;
  const username = String(telegramUser.username || '').trim().slice(0, 64) || null;

  for (let attempt = 0; attempt < MAX_MEMBER_ID_ATTEMPTS; attempt += 1) {
    const random = await db.get(sql`SELECT hex(randomblob(32)) AS bytes`);
    const memberId = memberIdFromHex(random.bytes);

    try {
      await db.insert(customers).values({
        telegramUserId,
        memberId,
        firstName,
        lastName,
        username,
      }).run();
      const created = await findByTelegramId(telegramUserId);
      if (!created) throw new Error('Account creation could not be confirmed.');
      return publicAccount(created);
    } catch (error) {
      // Another invocation may have created this same Telegram account first.
      const racedAccount = await findByTelegramId(telegramUserId);
      if (racedAccount) return publicAccount(racedAccount);
      if (attempt === MAX_MEMBER_ID_ATTEMPTS - 1) throw error;
    }
  }

  throw new Error('Could not create a PRIME account.');
}
