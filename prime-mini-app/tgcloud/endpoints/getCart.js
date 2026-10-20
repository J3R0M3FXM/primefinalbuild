import { getCustomerCart } from '../lib/cart.js';

export default async function (_input, ctx) {
  const user = ctx.initData.user;
  return getCustomerCart(user.id);
}
