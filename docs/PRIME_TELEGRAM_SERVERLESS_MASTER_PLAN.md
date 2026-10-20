# PRIME — Clean Telegram Serverless Master Plan

## 1. Architecture decision

- **GitHub** is the source-control and code-review home.
- **Telegram Serverless** hosts the Mini App static build, runs all backend endpoints and Telegram handlers, and stores all operational application data in its built-in SQLite database.
- **Supabase Storage** stores approved product images and private payment-proof files only. No Supabase Database, Auth, Functions, Realtime, or application API is used by the clean application.
- No Vercel, Prisma, external PostgreSQL, external object-storage provider, card gateway, courier API, or OCR provider is part of this build. **Geoapify is explicitly approved** for checkout address autocomplete, forward/reverse geocoding, and road routing.
- Telegram's own Mini App identity and Bot API are intrinsic platform capabilities, not additional application hosting/database providers.

The clean implementation will live in a new project directory in this branch. Existing application code in the repository is reference material only; the new app will not depend on its Next.js runtime or copy its implementation wholesale. Do not link this source tree to the live bot, deploy it, or migrate live records during local development.

## 2. Review of the supplied master plan

The product goals are coherent: mobile-first customer and admin experiences; Telegram identity; private Telegram IDs; permanent Member IDs; physical-product sales; inventory reservation; order-before-payment; manual proof review; configurable courier services and pricing; historical shipping snapshots; audit logs; and a staged feature roadmap.

The following supplied infrastructure sections are superseded by the requested architecture:

- Section 28's Next.js → Prisma → PostgreSQL stack becomes a static Mini App → Telegram Serverless endpoints/handlers → Telegram Serverless SQLite.
- Section 30's Vercel, Neon/other PostgreSQL, Blob storage, and other hosting/database providers are removed.
- Section 31 uses Supabase Storage for objects, with references and metadata in Telegram Serverless SQLite.
- Card gateway, courier API/booking, and external OCR integrations are excluded from this build. Geoapify is the approved exception for address autocomplete, geocoding, reverse geocoding, and driving/road routing; keep its API key server-side and call it through Telegram Serverless endpoints.

The visual requirement "responsive desktop support" remains in scope alongside mobile-first behavior. Do not inherit older fixed-phone-width layout rules from the legacy app if they conflict with this requirement. No horizontal scrolling; controls remain touch-friendly.

## 3. Product scope and deferred capabilities

### Initial release

- Telegram Mini App customer authentication using platform-validated init data.
- One owner/admin allowlist, with server-side authorization for every admin action. Keep the data model ready for staff roles without building a complex role editor yet.
- Customer record keyed internally by Telegram user ID; never expose that ID in customer views, URLs, receipts, or public API responses.
- Permanent, unique 12-character alphanumeric PRIME Member ID, excluding ambiguous characters `O`, `0`, `I`, `1`, and `L`; UUID remains the internal record key.
- Physical products, catalog, variants/options where required by the real product set, SKU, price, media, categories, stock, and admin inventory adjustments.
- Cart and server-validated checkout. Create the order before payment, snapshot line prices and address/shipping selections, and reserve available inventory safely.
- Manual QR/bank/e-wallet instructions, payment-proof upload, verification queue, approve/reject reason, customer notification through Telegram, and payment audit history.
- Admin order, customer, product, inventory, payment-verification, shipping-configuration, and audit screens.
- Telegram notifications for order and payment lifecycle events where the user has opened/authorized the bot to message them.
- Configurable local shipping services, serviceability areas, and pricing rules. Persist the full quote/rule snapshot on the order.

### Explicitly later

- Third-party card payment integration, automatic courier booking/tracking, OCR, vouchers/promotions, referrals/rewards, multiple staff roles, digital products, subscriptions, and entitlements.
- Physical-product schema may include a type discriminator for future growth, but digital fulfillment/subscriptions are not implemented in the initial release.

### Shipping constraint

Use Geoapify for checkout address autocomplete, forward geocoding, reverse geocoding, and driving/road routing. Route requests must be made server-side through Telegram Serverless so the API key never enters the client bundle. Validate and rate-limit inputs, handle provider errors safely, and persist the returned route distance/ETA with the quote. Keep shipping prices and serviceability rules configurable in Telegram Serverless SQLite; Geoapify supplies route data, not business pricing. If Geoapify is unavailable, do not substitute straight-line distance or invent an ETA: use an explicitly configured manual/zone fallback or block quote creation with a clear retry path.

## 4. Platform gates to resolve before production use

Official Telegram Serverless documentation describes static Mini App hosting, named endpoints called with `Telegram.WebApp.Serverless.call`, platform-validated Mini App init data, and persistent SQLite-backed storage. It also documents no foreign-key enforcement and separates code push from schema migration.

The public platform documentation reviewed for this plan does not establish the following capabilities for PRIME's required workload. Verify them using the exact current Serverless project/runtime before production cutover:

1. Multi-statement transaction/locking guarantees or an equivalent safe conditional-write primitive for stock reservation, payment transitions, and financial-ledger updates.
2. Database storage/query/concurrency limits and capacity headroom for the expected customer/order history.
3. A native scheduled-job mechanism for order expiration at the configured deadline. If none exists, define and disclose lazy expiry semantics; do not claim exact automatic expiry or release reserved stock on time without a supported trigger.
4. Supported secret/configuration storage for the Supabase Storage credential and any owner allowlist.
5. Database export, backup, restore, and rollback options. Define a repeatable application-level export if the platform has no native snapshot mechanism.
6. Upload/request limits for payment-proof files and Supabase Storage access controls.
7. Geoapify endpoint coverage, quotas/pricing, routing profile, response fields, and key restrictions for autocomplete, forward/reverse geocoding, and road routing. Keep credentials server-side and establish a safe outage/rate-limit fallback.

These are release gates. If a required guarantee cannot be met within Telegram Serverless, pause the affected production feature and document the platform constraint. Do not silently introduce another database, scheduler, hosting provider, or storage service.

### Local implementation status — 20 October 2026

The isolated branch now contains the responsive Mini App foundation, platform-verified account provisioning, live SQLite catalog reads, and source schema definitions for accounts, catalog/inventory, addresses, order snapshots, payments/proofs, shipping services, and audit events. Pure server-side helpers are in place for admin authorization, idempotency-key validation, order total/snapshot calculation, Geoapify URL/response handling, courier pricing, and Supabase Storage proof validation/upload/private-read operations. The Geoapify key was privately checked against autocomplete, forward/reverse geocoding, and road-routing requests, all of which returned successful responses. The storage and Geoapify helpers accept credentials as server-only arguments and are not yet called by endpoints.

No schema was migrated, no data was seeded, and no bot was linked or deployed. The Supabase personal access token grants Management API project access, but it is not a Storage API credential; no Storage server key was placed in source or browser code. Before wiring those providers into endpoints, verify how the current Telegram Serverless runtime securely supplies application secrets; its published SDK reference documents endpoint context and outbound HTTP but does not specify a secret binding mechanism. Inventory/order mutations also remain gated on verified transaction or atomic conditional-write support. The Geoapify routing contract was checked against [Geoapify's Routing API documentation](https://apidocs.geoapify.com/docs/routing/); its road-routing response supplies route distance in meters and time in seconds.

## 5. Ordered build phases

### Phase A — Fresh project foundation

- Work only on `rebuild/prime-clean-serverless` in its isolated worktree.
- Create a new, self-contained static React/TypeScript/Vite project with a local Telegram Serverless CLI dependency and the supported `tgcloud/` runtime layout.
- Keep the app build output and Serverless project configuration together so a single reviewed build can be hosted by Telegram Serverless.
- Keep browser code and server-only code separate. Serverless runtime modules import only the platform SDK and local runtime modules.
- Establish shared API shapes, validation/error conventions, loading/empty/error states, responsive mobile-first layout, and health/version diagnostics.
- Use environment/configuration variable names only in source; never commit secrets.

**Acceptance:** clean install and static build succeed; endpoint and UI contract is documented; no deployment or live database change is required for local review.

### Phase B — Identity and account foundation

- Use the platform-verified `ctx.initData.user` from Serverless endpoints; never authorize with `initDataUnsafe` or a caller-provided Telegram ID.
- Create or retrieve one customer row by Telegram ID and generate a permanent Member ID on first capture with collision-safe retry.
- Expose Member ID and approved profile fields to that same customer; keep Telegram ID private and admin-only.
- Add an explicit owner/admin allowlist check for all protected reads and writes.

**Acceptance:** same Telegram user resolves to the same customer across devices; spoofed identity and non-admin requests fail closed; public responses contain no Telegram UID or secrets.

### Phase C — Catalog and admin product management

- Implement product/category schema and server-side public catalog endpoints.
- Implement admin product create/read/update/activate and inventory adjustments with field allowlists and audit records.
- Store product images in Supabase Storage; retain path, MIME type, size, checksum, and visibility metadata in SQLite.
- Validate product uploads on the server; keep Storage credentials out of the client bundle.

**Acceptance:** catalog is read from SQLite, admin writes are authorized, and image access matches public/private policy.

### Phase D — Inventory, cart, and checkout

- Keep carts customer-scoped and validate current product state, quantity, SKU/variant, and price on the server.
- Implement available/reserved/committed stock and an append-only inventory event history.
- Create order and reserve inventory using only a transaction or conditional-write behavior verified on the target platform.
- Add request idempotency and exact server-side totals; never trust client price, stock, shipping fee, or discount.
- Snapshot product names/SKUs/prices and all order totals at order creation.

**Acceptance:** concurrent attempts to buy the final unit cannot oversell; retries cannot create duplicate orders or stock changes; ledger reconciliation is exact.

### Phase E — Manual payment and proof review

- Store public payment instructions separately from private server-side payment configuration.
- Let the customer submit an optional reference/note and upload a proof image to a private Supabase Storage path.
- Store the private file reference and metadata in SQLite; serve it only after endpoint authorization verifies the payment reviewer/admin.
- Implement distinct order and payment state machines, approve/reject reason, immutable audit event, and Telegram customer notification.
- Do not implement card API calls in this release.

**Acceptance:** customer cannot read another customer's proof; admin decisions are authorized, idempotent, auditable, and consistent with order/inventory state.

### Phase F — Geoapify-backed shipping configuration and order snapshots

- Implement courier and service profiles as configurable data rather than provider-specific code.
- Add service areas, weight/package limits, configurable base/first/succeeding charges, surcharge/night rules, and distance rounding only where the input distance is authoritative.
- Implement authenticated/rate-limited Serverless proxy endpoints for Geoapify address autocomplete, forward/reverse geocoding, and road routing. Never expose the API key to the Mini App.
- Use Geoapify road distance/ETA for quotes. Apply configured serviceability, weight/package constraints, and pricing rules in Serverless code; do not let the provider determine PRIME's price.
- Handle provider timeout, quota, invalid-address, and no-route responses explicitly. Do not fall back to straight-line distance or fabricate an ETA.
- Snapshot selected service, area/quote inputs, fee, breakdown, and pricing-rule version onto the order.

**Acceptance:** invalid services are not offered; later pricing edits cannot change historical order shipping data; UI clearly identifies any quote limitations.

### Phase G — Customer/admin completion and notifications

- Complete customer profile, Member ID, cart, checkout, payment instructions/proof, order history/details/status screens.
- Complete responsive mobile-first admin dashboard, order/payment queues, customers, products, inventory, shipping settings, and audit views.
- Add Telegram notifications for order/payment events with retry/idempotency protection and safe failure handling.
- Keep future-role data model options documented; do not expose an unimplemented role editor.

**Acceptance:** all initial-release workflows are usable on Telegram mobile and desktop without horizontal scrolling; server-side authorization remains authoritative.

### Phase H — Reliability, backup, and cutover rehearsal

- Verify target database, scheduler, quota, secret, and upload constraints from Phase 4.
- Test auth/authorization, order/payment state transitions, final-unit concurrency, duplicate requests, failed uploads, and interrupted workflows.
- Create encrypted, checksummed exports for SQLite business records and an object inventory for Supabase Storage. Rehearse restore into an isolated target and compare relationships, balances, inventory, order totals, and file checksums.
- Document deployment, configuration, backup/restore, incident handling, and rollback.
- Verify the release maps to a GitHub commit and review the exact CLI diff before any push.
- Switch the live Mini App only after acceptance, data strategy, rollback, and explicit production cutover approval.

**Acceptance:** restore rehearsal succeeds; all initial-release security/integrity checks pass; prior live app and data remain recoverable through the agreed rollback window.

## 6. Core invariants

- Server validates identity, ownership, admin access, price, discounts, shipping fee, and stock.
- Payment proof is evidence for an admin decision, not automatic proof of payment.
- Order state and payment state are separate, validated state machines.
- Inventory and financial changes are auditable and idempotent.
- Member ID is customer-facing; Telegram user ID is private.
- Historical item, payment, address, and shipping values are snapshots and never recomputed from current configuration.
- Receipts/payment proofs are private; public product media is separate.
- Never claim exact 30-minute expiry, atomic inventory safety, road distance, ETA, backup, restore, or production readiness until the platform behavior is demonstrated.

## 7. Definition of done

The clean customer Mini App and admin panel are hosted on Telegram Serverless; all operational data and business rules run in its native SQLite-backed Serverless runtime; approved files live in Supabase Storage only; GitHub contains the reviewed source and release history; the initial physical-goods/manual-payment workflows preserve the invariants above; and backup/restore, security, and cutover rehearsal gates pass before production traffic moves.
