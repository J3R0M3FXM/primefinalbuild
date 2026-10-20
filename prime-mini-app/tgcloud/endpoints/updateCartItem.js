import { setCustomerCartQuantity } from '../lib/cart.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  return setCustomerCartQuantity(user.id, input.productId, input.quantity);
}
