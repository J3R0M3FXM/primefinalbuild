import { requireAdmin } from '../lib/security.js';
import { adjustAdminInventory } from '../lib/adminCatalog.js';

export default async function (input, ctx) {
  const admin = await requireAdmin(ctx);
  return adjustAdminInventory(admin, input);
}
