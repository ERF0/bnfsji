# Bnafsaji

Bnafsaji is a Jordan-first multi-vendor marketplace. This repository is being built in tested vertical slices. It is not deployed and is not approved for live commerce.

## First slice: public catalog

`apps/web` is a JavaScript-source React Router application rendered on Cloudflare Workers. It provides Arabic-first RTL and English LTR storefront routes, database-backed public category and product search, sorting, seller storefronts, and product detail pages. `supabase/migrations/202610220001_public_catalog.sql` defines the public catalog records, approved launch categories, and read-only public RLS policies. `202610220003_catalog_rpc_bounds.sql` applies query and pagination bounds to direct RPC callers. The app contains no product fixtures.

Guest buyers can save product IDs to a device-local wishlist. After sign-in, the Worker merges those IDs into `wishlist_items`, protected by buyer-scoped PostgreSQL RLS. The local migration and policy behavior is tested with PGlite; hosted Supabase Auth, session cookies, and cross-device behavior have not been verified because no project is configured. The product variant model is approved: seller-defined bilingual options, one purchasable SKU per combination, and a default SKU when there are no options. The local catalog migration backfills existing products, derives public prices from eligible variants, and keeps seller SKU/on-hand quantity private. Product selection, guest cart identity, and wishlist price refresh are variant-aware. Seller product forms and stock adjustments are implemented locally. Product image upload uses a private Supabase Storage bucket, signed TUS upload tickets, per-product limits, seller isolation, upload verification, and time-limited transformed URLs; thumbnails are integrated into catalog, shop and product pages. Hosted Supabase migration/application, end-to-end Storage upload, image transformation plan/cost and production region review remain unverified.

Delivery pricing now has seller settings for one Amman-wide fee and an MFA-protected owner setting for one fixed multi-seller platform fee. Amounts are stored in integer fils, start unset, and each change is recorded in a restricted audit history. Checkout remains unavailable until the fees, delivery coverage and operations, payment provider, buyer verification, and legal requirements are configured and verified.

## Local development

Requirements: Node.js 22.12 or newer and npm. Copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars` and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the local canonical `PUBLIC_SITE_URL` (`http://localhost:5173`). `PUBLIC_SITE_URL` must be an HTTPS origin in a deployed environment. Never put a Supabase secret/service-role key in this file or any browser bundle. Without project settings, the storefront shows its explicit unconfigured state; it does not substitute sample products.

```powershell
cd apps/web
npm install
npm run dev
```

The Supabase migration must be applied to a development project before catalog queries can return data. Do not apply it to production as part of local setup.

## Verification

From `apps/web`, run the JavaScript and database checks with:

```powershell
npm test
npm run test:e2e
npm audit --audit-level=low
```

`npm test` includes an in-memory PostgreSQL run of the catalog migrations and RLS checks. This catches SQL and policy regressions without Docker, but it does not replace applying migrations to a Supabase development project or testing Supabase JWT claims there. `npm run test:e2e` builds the Worker, starts a local preview, and runs the Chromium storefront checks; install Playwright Chromium for a fresh environment with `npx playwright install chromium`.

The Rust quote crates have separate verification commands:

```powershell
cd packages/quote-kernel
cargo test --locked
cd ../quote-worker
cargo fmt --all -- --check
cargo check --locked --target wasm32-unknown-unknown
cargo build --locked --release --target wasm32-unknown-unknown
cargo clippy --locked --target wasm32-unknown-unknown -- -D warnings
```

## Rust quote calculation

`packages/quote-kernel` contains the JOD-fils calculation core. It applies the confirmed 7% standard or 2% subscribed seller commission to each seller's item subtotal after discounts, rounded half up to the nearest fil. It allocates a delivery amount proportionally by those subtotals using largest remainder, with ascending seller ID as a deterministic tie-break. Delivery allocation is for reporting and does not choose the settlement recipient or delivery-cost liability.

`packages/quote-worker` wraps the core in a versioned internal JOD quote endpoint. It rejects declared bodies over 8 KiB and incrementally reads the request stream with the same cumulative cap for absent or inaccurate `Content-Length` headers. It has no public Worker URL or route; it is intended for a future private Cloudflare service binding. Its current provisional contract accepts server-resolved seller subtotals and subscription plans. The adapter does not authenticate callers, resolve those inputs from Supabase, authorize discounts, or persist a ledger, and is not connected to checkout. Do not use it to authorize or settle live orders. Run `worker-build --release` from that package and use the workspace Wrangler to test it locally; do not deploy before service binding, authorization and release gates are approved.

## Build and preview

```powershell
cd apps/web
npm run build
npm run preview
```

Deployment is intentionally not run. Cloudflare/Supabase accounts, project region, HyperPay eligibility and credentials, courier terms, legal approvals, and the remaining release gates are not yet available. Live seller listings and transactions must not be enabled before those gates and the marketplace policy are approved.

## Approval documents

- [Founder decision register](docs/approval/decision-register.md)
- [61-area feature acceptance matrix](docs/approval/feature-acceptance-matrix.md)
- [Architecture and integration review](docs/approval/architecture-review.md)
- [Launch readiness gates](docs/release/LAUNCH_READINESS.md)
