import { requireAdmin } from '../lib/security.js';
import { saveAdminProduct } from '../lib/adminCatalog.js';

export default async function (input, ctx) {
  const admin = await requireAdmin(ctx);
  return saveAdminProduct(admin, input);
}
