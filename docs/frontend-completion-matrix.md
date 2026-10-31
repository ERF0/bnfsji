# Frontend route and feature completion matrix

Checked 2026-10-30. `IMPLEMENTED — INTEGRATION UNVERIFIED` means code and local tests exist but the hosted data or role journey has not been checked. `PARTIAL` means known frontend work remains. `BLOCKED BY EXTERNAL DEPENDENCY` means an authoritative service or approved content is absent. All routes below are localized under `/:locale` except `/` and `/auth/callback`. Browser checks cover signed-out/unconfigured states; they do not prove authenticated flows.

| Area | Role | Route(s) | Purpose and API/data | Required next interaction / check | Mobile, RTL and test state | Final status |
|---|---|---|---|---|---|---|
| Entry | All | `/`, `/:locale` | Redirect; public catalog RPC with live shop, option and fulfillment filters | Real inventory and category browse | 320px, both locales, SQL facet counts and preview search checked | IMPLEMENTED — INTEGRATION UNVERIFIED |
| Category | Buyer | `/:locale/c/:slug` | Public catalog RPC, sort, price and live facets | Hosted facet and count accuracy; subcategory model absent | SQL filter/visibility tests; route shell tested | PARTIAL |
| Product | Buyer | `/:locale/p/:shopSlug/:slug` | Public product, variants, media and same-category related products | Real stock/variant/cart and related-inventory browser journey | Related sample route browser checked; real data unverified | PARTIAL |
| Shop | Buyer | `/:locale/s/:slug` | Active shop, catalog and owner-written bilingual description | Apply profile migration; real shop and pagination browser journey | 320px and both locales tested; public query unit check | IMPLEMENTED — INTEGRATION UNVERIFIED |
| Cart | Buyer | `/:locale/cart`, `/cart/items` | Local lines, trusted refresh/quote; saved lines stay editable when catalog verification fails | Server order/payment contract | Unconfigured checkout gate and saved-line removal tested | PARTIAL / checkout BLOCKED |
| Wishlist | Buyer | `/:locale/wishlist`, `/wishlist/items` | Local IDs and authenticated RLS | Hosted auth merge and cross-device test | Browser and unit tests | PARTIAL |
| Account | Buyer/staff | `/:locale/account`, `/account/mfa`, `/account/reset-password`, `/auth/callback` | Supabase Auth | Real sign-in, MFA, recovery, OAuth | Signed-out routes tested | PARTIAL |
| Saved addresses | Buyer | `/:locale/account/addresses` | Authenticated add/edit/remove in Amman; user-scoped RLS | Apply migration and test real sign-in, persistence and checkout use | PGlite isolation and bilingual unconfigured browser state checked | IMPLEMENTED — INTEGRATION UNVERIFIED |
| Seller entry | Applicant | `/:locale/seller/apply` | Application and private proof upload | Authenticated save/submit/review test | Pending feedback added; signed-out test | PARTIAL |
| Seller home | Seller | `/:locale/seller` | Shop/setup RPCs | Authenticated setup journey | Mobile role navigation and account link checked | PARTIAL |
| Shop profile | Seller owner | `/:locale/seller/shop` | Owner-scoped name and bilingual description editing | Apply migration; test real owner save and public page update | PostgreSQL ownership test; signed-out/mobile route checked | IMPLEMENTED — INTEGRATION UNVERIFIED |
| Seller catalog | Seller staff | `/:locale/seller/products`, `/seller/product-images` | Scoped product, stock and image RPCs; local name/SKU search and status filter | Create/edit/publish/image and filtered-list journey with real shop | Pending feedback and signed-out account link; route shell tested | PARTIAL |
| Seller team | Seller owner | `/:locale/seller/staff` | Scoped staff RPCs | Invite/revoke role browser journey | Route shell tested | PARTIAL |
| Seller delivery | Seller owner | `/:locale/seller/delivery` | Scoped fee/history RPCs | Approved coverage/fee validation | Route shell tested | PARTIAL |
| Platform overview | Admin/owner | `/:locale/admin`, `/:locale/owner` | Role/MFA gates and review counts | Real role session; permission audit | Arabic overview, contrast, mobile and signed-out account link checked | PARTIAL |
| Seller review | Admin/owner | `/:locale/admin/sellers` | Application review and proof | Review → seller state transition | Signed-out shell tested | PARTIAL |
| Category review | Admin/owner | `/:locale/admin/categories` | Category proposal/approval RPC | Proposal → public category transition | Signed-out shell tested | PARTIAL |
| Admin access | Owner | `/:locale/owner/admins` | Owner/MFA gated role changes | Grant/revoke audit with real account | Signed-out shell tested | PARTIAL |
| Platform delivery | Owner | `/:locale/owner/delivery` | Owner/MFA gated fee/history | Approved fee in live quote | Signed-out shell tested | PARTIAL |
| Errors | All | `*`, offline page | Status-aware 401/403/404/500 boundary and offline asset | Hosted failure/reconnect observation | Localized 404 browser check; production build; other statuses source verified | IMPLEMENTED — INTEGRATION UNVERIFIED |
| Orders/payment/returns | Buyer/seller/admin | No routes | No authoritative order/payment/return model | Define and implement service contracts before UI | No browser journey possible | BLOCKED BY EXTERNAL DEPENDENCY |
| Support/moderation | Buyer/seller/admin | No routes | No support case, message, listing moderation model | Define scoped workflow and audit contract | No browser journey possible | BLOCKED BY EXTERNAL DEPENDENCY |
| Promotions/payouts/analytics | Seller/owner | No routes | No confirmed financial/promotion/event models | Define data source and role policy | No browser journey possible | BLOCKED BY EXTERNAL DEPENDENCY |
| Policy/help/info | All | No routes | Approved public copy unavailable | Add approved copy and routes | No route test possible | BLOCKED BY EXTERNAL DEPENDENCY |

No route is marked complete for production. The [release gates](release/LAUNCH_READINESS.md) remain authoritative.
