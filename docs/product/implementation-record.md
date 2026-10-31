# Implementation record

## 2026-10-26 — repository audit and search slice

**System:** `apps/web` is a React Router 8/Cloudflare Worker storefront with Supabase catalog/Auth/RLS, local guest cart and wishlist, seller/admin routes, PGlite migration tests and Playwright smoke tests. Rust quote code lives under `packages/`; checkout is intentionally disabled. No `.git` metadata or local `.dev.vars` is present in this workspace. Environment names are documented in `apps/web/.dev.vars.example`; values were not inspected.

**Changed:** `supabase/migrations/202610260001_catalog_search_normalization.sql` adds bounded Arabic normalization and literal substring search to the existing catalog RPC, preserving its signature, public-status checks, stock/price filtering and pagination. Default query sort now favors exact and prefix product titles. `apps/web/app/lib/catalog.migrations.test.js` covers the migration as an anonymous buyer. A 320px browser failure exposed a later CSS override of the one-column header; `apps/web/app/showcase.css` now restores the compact header layout. The non-showcase home intro is shorter and uses no invented product art, moving categories/catalog content higher. `apps/web/app/routes/catalog.jsx` now provides the actual `#product-results` anchor promised by its browse button. No package was added.

**Verification:** Before edits, `cd apps/web; npm test` passed 71/71. After the search edit, `node --test app/lib/catalog.migrations.test.js` passed, `npm test` passed 71/71, and `npm run build` passed. Focused Playwright first failed at 320px English overflow; after the CSS fix, the focused 3 tests passed. After the intro/anchor edit, full `npm run test:e2e` passed (19/19), including an actual click on the browse anchor; `npm run build` passed. The helper-permission assertion also passed its focused PGlite test. A local 390px Arabic screenshot was inspected before and after the intro change. These use PGlite and a local Worker preview; they are not hosted Supabase acceptance tests.

**State:** Search slice is **PARTIAL** pending migration application to a development Supabase project and a real inventory browser journey. Checkout and live order acceptance remain **BLOCKED** by the existing launch gates. No production migration or deployment occurred.

**Next unblocked work:** Verify mobile navigation and product discovery against real development inventory when connected; implement database-backed facets from actual variant attributes; benchmark search latency before selecting an index. Preserve the sample-only showcase boundary.

**Risks:** Search currently normalizes titles and shop names at query time, so large-catalog latency is unmeasured. Public data depends on the `security definer` RPC's explicit active-status and stock checks. The new migration has not been applied to a hosted project. Mobile and keyboard behavior with real product content remain unverified.
