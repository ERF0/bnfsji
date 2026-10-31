# Frontend integration blockers

Checked 2026-10-26 against routes, migrations and local configuration. These are exact dependencies, not permission requests.

| Outcome | Missing dependency | Safe current frontend behavior |
|---|---|---|
| Real catalog and seller journey verification | Development Supabase URL/publishable key, applied migrations, active approved shop/category/products, test accounts and JWT role claims | Explicit unconfigured/empty states; local showcase remains labeled and isolated |
| Live facets and saved buyer addresses | Apply `202610260002_live_catalog_facets.sql` and `202610260003_buyer_addresses.sql` to a development Supabase project, then test real buyer accounts and active inventory | PostgreSQL migration and RLS checks pass locally; catalog/address pages state unavailable or unconfigured truthfully |
| Seller-managed public shop profile | Apply `202610260004_shop_profiles.sql`, then verify owner save and public shop rendering against a development Supabase project | Local PostgreSQL test confirms owner and active-status gates; signed-out route and production build checked |
| Repeat-safe product creation | `create_seller_product` RPC has no client idempotency key or unique request constraint | Seller form disables repeat click while pending; refresh/retry duplication remains possible and must be solved server-side |
| Save product draft | Existing `create_seller_product` RPC always inserts `status='published'` | UI says Publish; no false draft action |
| Checkout and order history | No order tables/actions, address/delivery eligibility, authorized payment integration, idempotent order API or callback contract | Cart refreshes catalog/quote where configured and states checkout is unavailable |
| Seller order work, payouts and confirmed analytics | No persisted orders, settlements or payout records | No invented order queues, revenue or balances outside dev-only showcase |
| Support, moderation and returns | No case/message/return or product-review workflow and role/audit contract | No public action implies these services exist |
| Public policies/help | Approved returns, delivery, terms, privacy and contact copy unavailable in this workspace | No invented promises or policy pages |

See [launch readiness](release/LAUNCH_READINESS.md) for provider, legal, deployment and operations gates. No external service was activated or deployed.
