# Frontend verification

## 2026-10-30 completion cycle

- Baseline `npm test` passed **75/75** and `npm run test:e2e` passed **35/35**.
- The production build passed before and after status-aware error recovery was added.
- Focused Chromium `npm run test:e2e -- --grep "not-found recovery"` passed **1/1** after the error-boundary change.
- The root error boundary now distinguishes 401, 403, 404, and 500-class recovery and provides localized sign-in, retry, or marketplace actions as appropriate.
- Responsive overflow coverage exercises 320, 375, 390, 768, 1024, 1280, 1440, and 1920 pixel widths in both Arabic and English; focused Chromium passed **1/1**.
- Fee and access-management controls now disable during pending navigation to prevent duplicate seller delivery, platform delivery, seller-team, and platform-admin mutations.
- Final combined verification passed: `npm test` **75/75**, `npm run build`, and `npm run test:e2e` **35/35**.

## 2026-10-26 local run

- Source inventory: `apps/web/app/routes.js`, route components, Supabase migrations, package manifest and existing tests inspected. Running development server at `http://localhost:5173/` returned HTTP 200 for `/en` before this slice.
- Focused Chromium: `cd apps/web; npm run test:e2e -- --grep 'workspaces use their own navigation|portal navigation exposes'` → 2/2 passed. This verifies Arabic/English overview links and no buyer bottom bar on seller/admin/owner routes at 390px, plus the original portal navigation behavior.
- Focused Chromium: `npm run test:e2e -- --grep 'unsupported locale|workspaces use their own navigation'` → 2/2 passed. Unsupported locale workspace URLs returned 404.
- Initial full `npm run test:e2e` after the root locale guard failed 2/21 tests: search and showcase filter client navigations received 404. Playwright trace showed the request `/en.data?q=linen`. The guard now accepts React Router's `.data` URL for valid locales while rejecting `/fr` workspace routes. The three affected focused tests then passed.
- Final `npm run test:e2e` → **22/22 passed**, including localized account links from signed-out seller/admin/owner screens. `npm test` → **71/71 passed**. Final `npm run build` → **passed**.
- Visual: 390px screenshots of signed-out Arabic admin and English seller screens were inspected. A low-contrast workspace navigation override was corrected; a second Arabic admin screenshot confirmed the inactive links are legible. These are visual checks, not measured WCAG contrast results.

## Limits

Chromium signed-out/unconfigured tests do not prove authenticated seller/admin mutations. No real inventory, orders, payments, mobile device, screen reader, field Core Web Vitals or hosted Supabase tests were available. No claim of WCAG conformance or release readiness is made.

## Live catalog filter slice

- `node --test app/lib/catalog.migrations.test.js` passed with the new migration applied in PGlite. Tests check public facet counts, active shop/stock visibility, selected shop/fulfillment/options, and invalid option input.
- `npm test` passed **71/71** after the catalog client test was updated for the third public facet read. `npm run build` passed.
- After the saved-address addition, `npm test` passed **72/72**, `npm run test:e2e` passed **24/24**, and `npm run build` passed. The new address migration passed an embedded PostgreSQL test of authenticated read/edit/delete isolation and anonymous denial.
- No Supabase CLI, Docker or `psql` executable was found locally. The new migration and catalog behavior have not been exercised against a hosted Supabase project.

## Seller shop profile slice

- `202610260004_shop_profiles.sql` passed a PGlite test: the active owner can edit bilingual details, another authenticated user cannot, suspended shops cannot be edited, and anonymous callers cannot invoke the RPCs.
- The public shop loader test confirms that the query requests both description fields. The route renders their localized value and caps the SEO description to 300 characters.
- `npm test` passed **73/73**; `npm run test:e2e` passed **27/27**, including the bilingual signed-out shop profile route. `npm run build` passed after the admin count display adjustment.
- A development Supabase project with active inventory and owner credentials is still needed to verify a real save and public page refresh.

## Product discovery slice

- Product pages now show up to four other products from the same public category. The query uses the existing catalog loader; if that read fails, the product page remains available without a related-products section. The local sample preview remains labeled.
- Focused Chromium verified that the sample product page excludes the current item, links to another item in its category, and preserves preview mode. A 390px screenshot was inspected for legibility. The production build passed.
- The user confirmed that a development Supabase project is not available yet. Live category recommendations, owner profile saves, addresses and authenticated roles remain integration unverified.

## Cart recovery slice

- When the catalog cannot be reached or is not configured, the cart shows locally saved lines with quantity and remove controls. It does not show unverified prices or allow checkout.
- Focused Chromium verified removal of a saved line in the unconfigured state. The production build passed after this change.
- Final combined checks: `npm test` passed **73/73**, `npm run test:e2e` passed **28/28**, and `npm run build` passed. The existing development server returned HTTP 200 at `http://localhost:5173/en`.

## Seller catalog findability

- Added client-side product name/SKU search and status filtering to the existing authorized seller list, including a distinct no-matches state. The production build passed. This interaction still needs an authenticated seller browser check when development Supabase is available.
