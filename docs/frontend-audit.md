# Frontend audit

Checked 2026-10-26 against `apps/web`, `supabase/migrations`, the running local app, and the existing tests. This is a source and local-preview audit, not a hosted-service acceptance result.

## Current system

- React 19, React Router 8, Vite, Cloudflare Workers, Supabase SSR/Auth and PostgreSQL RLS. JavaScript/JSX source, CSS in `app.css`, `catalog.css`, and `showcase.css`.
- Buyer routes load real public catalog data when Supabase is configured. Guest cart and wishlist persist locally; authenticated wishlist uses buyer-scoped RLS. Product media uses signed private images. Development showcase is explicitly labeled sample data.
- Seller application, catalog/variants/stock, image management, staff and delivery routes have Supabase operations. Admin seller/category review and owner admin/delivery controls have role checks. Actual order, payment, support, returns, promotion and payout models are absent from the migrations.
- Server quote calculation exists behind a private Worker binding, but no order-creation or payment flow is connected. Checkout is visibly disabled.
- Local workspace has no `.dev.vars` or `.git`; environment variable **names** are in `apps/web/.dev.vars.example`. Hosted credentials, active inventory and real role sessions are unavailable in this audit.

## Verified frontend issues and decisions

| Finding | Evidence | Action |
|---|---|---|
| Buyer bottom navigation appeared on seller/admin/owner routes at mobile width. | `root.jsx` rendered it after every route; Chromium route check | Hide it on workspace paths and rely on the existing workspace navigation. |
| Arabic admin and owner navigation omitted their overview route. | `portal-navigation.jsx` route list | Add the same overview destination available in English. |
| Unsupported locale prefixes could reach some workspace loaders as Arabic. | `admin-home.jsx` and other route loaders defaulted locale | Reject invalid locale prefixes centrally with HTTP 404. |
| Seller application/product buttons remained active while a mutation was pending. | Route components and React Router navigation state | Disable repeat clicks and expose bilingual status text. Backend product-create idempotency remains open. |
| Signed-out seller/owner overview and catalog screens gave instructions without a sign-in action. | Route components and mobile screenshots | Link directly to the localized account page. |
| Workspace navigation links were low contrast on the dark background. | 390px Arabic admin and English seller screenshots; CSS specificity | Override the inactive link color at workspace specificity. |
| Shop, fulfillment and option filters existed only in the development showcase. | `catalog.jsx` gated the controls and `loadCatalog` ignored those URL parameters. | Add a public, status-scoped facet RPC and extend catalog search with variant filters. PostgreSQL tests cover counts, visibility and selection; hosted inventory remains unverified. |
| Search in the local preview silently exited sample mode. | Search form omitted the `showcase` parameter. | Preserve the explicit preview flag and browser-test the result. |
| Buyer account had no saved delivery address flow. | `account.jsx`, routes and migrations had no address model. | Add an Amman-only address book with authenticated forms and owner-scoped RLS. It makes no claim that delivery or checkout is available. |
| Seller owners could not update the name or description shown on their public shop. | `shops` had names but no editable profile operation; `shop.jsx` showed only products. | Add an owner-scoped bilingual profile editor and public shop description. Keep the shop slug fixed. |
| Ordinary admins saw a zero pending-category count that only an owner can query. | `admin-home.jsx` skipped the owner-gated proposal RPC for admins but rendered `0`. | Omit the count for ordinary admins; retain their proposal entry point. |

## Remaining high-impact gaps

See [completion matrix](frontend-completion-matrix.md) and [integration blockers](frontend-integration-blockers.md). The next highest-value work is verifying live catalog and seller flows against a development Supabase project. Real commerce, orders, support, and returns require authoritative backend contracts before a truthful frontend can be completed.
