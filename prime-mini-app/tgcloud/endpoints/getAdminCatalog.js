import { requireAdmin } from '../lib/security.js';
import { listAdminProducts } from '../lib/adminCatalog.js';

export default async function (_input, ctx) {
  await requireAdmin(ctx);
  return listAdminProducts();
}
