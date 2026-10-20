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
- Admin authorization uses verified Telegram init data and the database-backed `system_settings.admin_telegram_user_id` allowlist, matching the existing Serverless project; unknown users fail closed.
- `configureProductStorage` stores the Supabase Storage server key in Serverless SQLite and returns configuration status only. `uploadProductImage` uploads validated images to the configured public product bucket and records the object path in SQLite; the key never enters the browser response.
- SQLite schema foundation for customers, products/inventory, saved addresses, order and item snapshots, payments/proofs, inventory history, shipping services, and audit events.
- Pure business-logic helpers for server-side admin authorization, idempotency-key validation, order totals/snapshots, configurable shipping prices, Geoapify request/route parsing, and Supabase payment-proof validation/private URLs.

Schema additions are source definitions only. They have **not** been migrated to any bot database.

## Initial endpoints

- `getOrCreateAccount`: uses platform-verified Telegram identity and returns only the customer-facing Member ID and display name.
- `getCatalog`: reads active products from Telegram Serverless SQLite.
- `getCart`: loads the signed-in customer's cart.
- `updateCartItem`: sets a cart line quantity or removes it when quantity is zero.
- Admin endpoints require the owner Telegram ID to be present in `system_settings.admin_telegram_user_id`. The clean target has no allowlist row yet, so admin access remains intentionally unavailable until the owner setting is provisioned safely.

## Remaining work and platform gates

Supabase Storage credentials are held in a server-only `system_settings` row, following the existing Serverless app's pattern; callers can only check configured status. Never place credentials in endpoint source, browser build configuration, `VITE_*`, or GitHub. Product image upload is implemented, but the bucket must be created and made public, the service key must be entered by an authorized admin, and Telegram Serverless endpoint payload limits must be checked before live use. Initial owner provisioning and atomic inventory adjustment plus audit guarantees remain gates; the clean target has no admin allowlist row. Checkout is intentionally disabled until atomic order creation and stock reservation, shipping quote validation, order expiry scheduling, and payment-proof Storage access are implemented. Admin UI, Geoapify quotas, and backup/restore remain later-phase work. Do not treat a local build as a production migration or deployment.
