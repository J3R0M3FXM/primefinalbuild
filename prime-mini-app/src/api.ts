import type { TelegramServerlessError } from './platform';

export interface CustomerAccount {
  memberId: string;
  displayName: string;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: 'PHP';
  category: string | null;
  imageUrl: string | null;
  weightGrams: number | null;
  availableStock: number;
}

export interface CartProduct {
  id: string;
  sku: string;
  name: string;
  priceMinor: number;
  currency: 'PHP';
  category: string | null;
  weightGrams: number | null;
  availableStock: number;
  isActive: boolean;
}

export interface CartLine {
  productId: string;
  quantity: number;
  lineTotalMinor: number;
  product: CartProduct | null;
}

export interface CustomerCart {
  cartId: string;
  items: CartLine[];
  subtotalMinor: number;
  currency: 'PHP';
}

function call<T>(name: string, input: Record<string, unknown> = {}): Promise<T> {
  const api = window.Telegram?.WebApp?.Serverless;
  if (!api) {
    return Promise.reject(new Error('Open PRIME from its Telegram Mini App to continue.'));
  }

  return new Promise((resolve, reject) => {
    api.call<T>(name, input, (error: TelegramServerlessError | null, result?: T) => {
      if (error) reject(new Error(error.message || 'The request could not be completed.'));
      else if (result === undefined) reject(new Error('The server returned an empty response.'));
      else resolve(result);
    });
  });
}

export function getOrCreateAccount(): Promise<CustomerAccount> {
  return call<CustomerAccount>('getOrCreateAccount');
}

export function getCatalog(): Promise<CatalogProduct[]> {
  return call<CatalogProduct[]>('getCatalog');
}

export function getCart(): Promise<CustomerCart> {
  return call<CustomerCart>('getCart');
}

export function setCartQuantity(productId: string, quantity: number): Promise<CustomerCart> {
  return call<CustomerCart>('updateCartItem', { productId, quantity });
}
