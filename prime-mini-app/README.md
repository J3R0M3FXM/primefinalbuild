# PRIME Telegram Mini App

Clean frontend and Telegram Serverless backend for PRIME Commercial. This project is intentionally separate from the legacy Next.js application in the repository.

## Runtime boundaries

- Vite builds the browser app into `dist/`; Telegram Serverless hosts that static build.
- `tgcloud/` contains only Serverless schema, endpoints, handlers, and shared runtime modules.
- Telegram Serverless SQLite is the operational database.
- Supabase is reserved for Storage objects. Do not add Supabase Database/Auth clients or browser-side privileged credentials.
- Keep third-party credentials in the Serverless secret/configuration facility, never in Git or `VITE_*` variables.

## Local development

```sh
npm install
npm run dev
npm run build
```

The Mini App data path requires Telegram's Serverless web app bridge. Opening the static page outside the configured Telegram Mini App intentionally does not use mock data or local identity fallbacks.

## Telegram Serverless workflow

Review `tgcloud status` and `tgcloud diff` before any deployment. Build the static app before `tgcloud push`. Schema changes are separate: review the platform's proposed migration before applying it. This project has its own `.tgcloud/` root marker so the CLI does not inherit the live bot's state from the parent checkout. Never link this project to the production bot during development; any staging deployment requires a separately verified target.

## Implemented foundation

- Responsive React Mini App with server-backed catalog, customer account, and persistent cart flows.
- `getOrCreateAccount`: uses platform-verified Telegram identity and returns only the customer-facing Member ID and display name.
- `getCatalog`: reads active products from Telegram Serverless SQLite; no sample products are injected.
- `getCart` and `updateCartItem`: load and update the authenticated customer's cart, with server-side product availability and current-stock validation.
- `getAdminCatalog`, `saveAdminProduct`, and `adjustAdminInventory`: admin-only product listing, physical product create/update/activation, and reasoned stock adjustments with audit/history records.
- Admin authorization uses verified Telegram init data and an active database-backed `admin_users` allowlist; unknown, inactive, and unsupported-role users fail closed.
- SQLite schema foundation for customers, products/inventory, saved addresses, order and item snapshots, payments/proofs, inventory history, shipping services, and audit events.
- Pure business-logic helpers for server-side admin authorization, idempotency-key validation, order totals/snapshots, configurable shipping prices, Geoapify request/route parsing, and Supabase payment-proof validation/private URLs.

Schema additions are source definitions only. They have **not** been migrated to any bot database.

## Initial endpoints

- `getOrCreateAccount`: uses platform-verified Telegram identity and returns only the customer-facing Member ID and display name.
- `getCatalog`: reads active products from Telegram Serverless SQLite.
- `getCart`: loads the signed-in customer's cart.
- `updateCartItem`: sets a cart line quantity or removes it when quantity is zero.
- Admin endpoints require a corresponding active `admin_users` row. The initial owner provisioning procedure is not yet verified for this target project, so admin access remains intentionally unavailable until that is done safely.

## Remaining work and platform gates

The backend contract for securely configuring third-party credentials in Telegram Serverless must be verified before Geoapify or Supabase Storage endpoints can be wired. Do not place credentials in endpoint source, frontend input, `VITE_*`, or GitHub. Product image storage, initial owner provisioning, and atomic inventory adjustment plus audit guarantees remain platform gates; no admin row has been provisioned. Checkout is intentionally disabled until atomic order creation and stock reservation, shipping quote validation, order expiry scheduling, and payment-proof Storage access are implemented. Admin UI, Geoapify quotas, and backup/restore remain later-phase work. Do not treat a local build as a production migration or deployment.
