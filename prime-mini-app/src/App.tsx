import { useEffect, useMemo, useState } from 'react';
import { getCart, getCatalog, getOrCreateAccount, setCartQuantity, type CatalogProduct, type CustomerAccount, type CustomerCart } from './api';

type LoadState = 'loading' | 'ready' | 'error';
type Tab = 'shop' | 'cart' | 'account';

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [error, setError] = useState('');
  const [cartError, setCartError] = useState('');
  const [updatingProduct, setUpdatingProduct] = useState('');
  const [tab, setTab] = useState<Tab>('shop');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();

    let active = true;
    async function initialize() {
      try {
        const [customer, catalog, customerCart] = await Promise.all([getOrCreateAccount(), getCatalog(), getCart()]);
        if (!active) return;
        setAccount(customer);
        setProducts(catalog);
        setCart(customerCart);
        setLoadState('ready');
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'PRIME could not load. Try again.');
        setLoadState('error');
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      `${product.name} ${product.sku} ${product.category ?? ''}`.toLocaleLowerCase().includes(query),
    );
  }, [products, search]);

  const cartCount = cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;

  async function changeQuantity(productId: string, quantity: number) {
    setUpdatingProduct(productId);
    setCartError('');
    try {
      setCart(await setCartQuantity(productId, quantity));
    } catch (cause) {
      setCartError(cause instanceof Error ? cause.message : 'Cart update failed. Please try again.');
    } finally {
      setUpdatingProduct('');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#shop" onClick={() => setTab('shop')} aria-label="PRIME home">
          <span className="brand-mark">P</span>
          <span><strong>PRIME</strong><small>COMMERCIAL</small></span>
        </a>
        <span className="live-status"><i /> PRIME STORE</span>
      </header>

      {tab === 'shop' ? (
        <section className="store-view" aria-labelledby="store-title">
          <div className="hero">
            <div className="hero-copy">
              <p className="eyebrow">THE PRIME COLLECTION</p>
              <h1 id="store-title">Built for<br /><em>what’s next.</em></h1>
              <p className="hero-note">Explore the collection, made to move with you.</p>
            </div>
            <div className="hero-orbit" aria-hidden="true"><span>P</span></div>
          </div>

          <div className="section-heading">
            <div><p className="eyebrow">CURATED FOR YOU</p><h2>Shop the collection</h2></div>
            <span className="product-count">{loadState === 'ready' ? `${products.length} ITEMS` : '— ITEMS'}</span>
          </div>

          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" />
            <kbd>SEARCH</kbd>
          </label>

          {loadState === 'loading' && <div className="message-card"><span className="spinner" /><p>Loading the PRIME collection…</p></div>}
          {loadState === 'error' && (
            <div className="message-card error-card" role="alert">
              <p className="eyebrow">STORE UNAVAILABLE</p><p>{error}</p>
              <button className="text-button" onClick={() => window.location.reload()}>Try again <span>↗</span></button>
            </div>
          )}
          {loadState === 'ready' && filteredProducts.length === 0 && (
            <div className="message-card empty-card">
              <span className="empty-glyph" aria-hidden="true">✳</span>
              <p className="eyebrow">{products.length ? 'NO MATCHES' : 'THE COLLECTION IS IN PROGRESS'}</p>
              <p>{products.length ? 'Try a different search.' : 'New pieces are on the way. Check back soon.'}</p>
            </div>
          )}
          {loadState === 'ready' && filteredProducts.length > 0 && (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <span className="product-image-mark">P<span>RIME</span></span>}
                    {product.availableStock <= 0 && <span className="stock-badge">SOLD OUT</span>}
                  </div>
                  <div className="product-meta"><span>{product.category || 'PRIME'}</span><span>{product.sku}</span></div>
                  <h3>{product.name}</h3>
                  {product.description && <p className="product-description">{product.description}</p>}
                  <div className="product-bottom"><strong>{formatPrice(product.priceMinor, product.currency)}</strong><button aria-label={`Add ${product.name} to cart`} disabled={product.availableStock <= 0 || updatingProduct === product.id} onClick={() => void changeQuantity(product.id, (cart?.items.find((item) => item.productId === product.id)?.quantity ?? 0) + 1)}>{updatingProduct === product.id ? '…' : '+'}</button></div>
                </article>
              ))}
            </div>
          )}

          <footer className="store-footer"><span>PRIME · PHILIPPINES</span><span>CRAFTED TO MOVE FORWARD</span></footer>
        </section>
      ) : tab === 'cart' ? (
        <section className="cart-view">
          <div className="cart-heading"><p className="eyebrow">YOUR SELECTION</p><h1>Shopping<br /><em>cart.</em></h1></div>
          {cartError && <div className="cart-alert" role="alert">{cartError}</div>}
          {!cart || cart.items.length === 0 ? (
            <div className="message-card empty-card"><span className="empty-glyph" aria-hidden="true">✳</span><p className="eyebrow">YOUR CART IS EMPTY</p><p>Find something for what’s next.</p><button className="text-button" onClick={() => setTab('shop')}>Browse the collection <span>↗</span></button></div>
          ) : (
            <>
              <div className="cart-lines">
                {cart.items.map((item) => {
                  const product = item.product;
                  const unavailable = !product?.isActive || !product;
                  const outOfStock = !unavailable && item.quantity > product.availableStock;
                  return (
                    <article className="cart-line" key={item.productId}>
                      <div className="cart-product-mark" aria-hidden="true">P</div>
                      <div className="cart-product-info">
                        <span className="cart-category">{product?.category || 'PRIME'}</span>
                        <h2>{product?.name || 'Unavailable product'}</h2>
                        <span className="cart-sku">{product?.sku || item.productId}</span>
                        {(unavailable || outOfStock) && <span className="cart-stock-warning">{unavailable ? 'No longer available' : `Only ${product.availableStock} available`}</span>}
                        <div className="quantity-control" aria-label={`Quantity for ${product?.name || 'product'}`}>
                          <button aria-label="Decrease quantity" disabled={updatingProduct === item.productId} onClick={() => void changeQuantity(item.productId, item.quantity - 1)}>−</button>
                          <span>{item.quantity}</span>
                          <button aria-label="Increase quantity" disabled={unavailable || item.quantity >= product.availableStock || updatingProduct === item.productId} onClick={() => void changeQuantity(item.productId, item.quantity + 1)}>+</button>
                          <button className="remove-item" disabled={updatingProduct === item.productId} onClick={() => void changeQuantity(item.productId, 0)}>Remove</button>
                        </div>
                      </div>
                      <strong className="cart-line-price">{formatPrice(item.lineTotalMinor, cart.currency)}</strong>
                    </article>
                  );
                })}
              </div>
              <aside className="cart-summary">
                <div><span>Subtotal</span><strong>{formatPrice(cart.subtotalMinor, cart.currency)}</strong></div>
                <p>Shipping and payment are selected at checkout.</p>
                <button className="checkout-button" disabled>Checkout setup in progress</button>
              </aside>
            </>
          )}
        </section>
      ) : (
        <section className="account-view">
          <p className="eyebrow">YOUR PRIME ACCOUNT</p>
          <h1>Welcome,<br /><em>{account?.displayName || 'Member'}.</em></h1>
          <div className="member-card">
            <div className="member-card-top"><span>PRIME MEMBER</span><span>EST. PRIME</span></div>
            <div className="member-card-bottom"><div><small>MEMBER ID</small><strong>{account?.memberId || '────────────'}</strong></div><span className="member-symbol">P</span></div>
          </div>
          <div className="account-links"><button disabled>Order history <span>↗</span></button><button disabled>Personal details <span>↗</span></button></div>
          <p className="account-note">Your Telegram account keeps your PRIME membership available across devices.</p>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}><span className="nav-icon">⌂</span><span>SHOP</span></button>
        <button className={tab === 'cart' ? 'active' : ''} onClick={() => setTab('cart')}><span className="nav-icon">▱</span><span>CART{cartCount ? ` · ${cartCount}` : ''}</span></button>
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><span className="nav-icon">◉</span><span>ACCOUNT</span></button>
      </nav>
    </main>
  );
}
