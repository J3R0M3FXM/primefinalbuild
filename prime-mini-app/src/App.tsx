import { useEffect, useMemo, useState } from 'react';
import { getCatalog, getOrCreateAccount, type CatalogProduct, type CustomerAccount } from './api';

type LoadState = 'loading' | 'ready' | 'error';
type Tab = 'shop' | 'account';

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
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('shop');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();

    let active = true;
    async function initialize() {
      try {
        const [customer, catalog] = await Promise.all([getOrCreateAccount(), getCatalog()]);
        if (!active) return;
        setAccount(customer);
        setProducts(catalog);
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
                  <div className="product-bottom"><strong>{formatPrice(product.priceMinor, product.currency)}</strong><button aria-label={`View ${product.name}`} disabled={product.availableStock <= 0}>↗</button></div>
                </article>
              ))}
            </div>
          )}

          <footer className="store-footer"><span>PRIME · PHILIPPINES</span><span>CRAFTED TO MOVE FORWARD</span></footer>
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
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><span className="nav-icon">◉</span><span>ACCOUNT</span></button>
      </nav>
    </main>
  );
}
