# Consumer feature matrix

Checked 2026-10-26. Status means Bnafsaji implementation evidence, not SHEIN parity. `PARTIAL` is local code without complete production evidence; `BLOCKED` needs an external service or operational decision. Competitor behavior is **UNKNOWN** except the retrieved [SHEIN Jordan category facets](../intelligence/competitor-observations.md).

| Capability | Status | Prerequisite / proof for completion | Customer outcome |
|---|---|---|---|
| Bilingual home, categories and product cards | PARTIAL | Hosted active inventory and mobile/desktop browser test | Browse products without login |
| Search URL, Arabic normalization, literal matching, default relevance | PARTIAL | Apply migration 202610260001 to development Supabase; test real Arabic/English inventory and latency | Find intended products |
| Autocomplete, trending/recent searches, Arabizi, typo correction, seller/category suggestions, visual search | UNKNOWN | Inventory and search evidence; consent/retention for history and images | Faster recovery from uncertain queries |
| Category landing pages and dynamic multiselect size/color/style facets | PARTIAL | Real variant attribute schema and bounded database facets; Jordan SHEIN page documents comparable facets | Narrow choices quickly |
| Price filter and sorting | PARTIAL | Hosted RPC and browser verification | Compare affordable items |
| PDP gallery, variant selector, seller link, wishlist and cart | PARTIAL | Real images, active stock, seller data, bilingual browser journey | Evaluate and save a product |
| Size guides, verified/photo reviews, similar products, Shop the Look | UNKNOWN | Seller size data, order-linked review/moderation contract, inventory volume | Understand fit and quality |
| Persistent cart and guest continuity | PARTIAL | Cross-session/device tests and real catalog refresh | Resume shopping |
| Delivery details and trusted quote | PARTIAL | Approved coverage/fees and deployed private quote binding | Know total cost |
| Guest checkout, payment, order creation/tracking, returns | BLOCKED | Merchant/provider approval, phone verification, authorized order/payment/delivery operations and legal review | Complete and recover a real purchase |
| Seller storefront | PARTIAL | Hosted active sellers and public catalog browser test | Inspect a shop |
| Seller rating/following | UNKNOWN | Verified transaction and moderation data | Trust and revisit shops |
| Promotions, coupons, bundles, flash offers | UNKNOWN | Server-authoritative pricing, eligibility and approved economics | Understand genuine offers |
| Personalization, recommendations, recently viewed | PARTIAL | Consent-scoped activity and relevance validation; recently viewed is device local | Continue discovery |
| Saved addresses, preferences, notifications | UNKNOWN | Privacy policy, account storage and messaging provider | Reduce repeat entry |
| Arabic RTL / English LTR, responsive PWA | PARTIAL | Physical devices, keyboard/screen reader and field performance checks | Shop accessibly across devices |
| Authorization, order/payment integrity, operational recovery | PARTIAL | Hosted RLS/JWT, concurrency, callback, restore and incident tests | Safe transactions |

Independent local advantage under investigation: accurate Jordan delivery eligibility, JOD totals and merchant identity. No local operational advantage is claimed before verification. See the [evidence register](../intelligence/evidence-register.md) and [launch gates](../release/LAUNCH_READINESS.md).

## Remaining §20 capability inventory

The rows above combine related capabilities. This inventory keeps the individual requested features visible. `P` = PARTIAL local implementation, `B` = BLOCKED external dependency, `U` = UNKNOWN/unimplemented. None is marked `DONE` for live commerce.

| Area | Individual capabilities and state |
|---|---|
| Discovery | Personalized homepage U; trends/collections U; new arrivals P; best sellers U; flash promotions U; continuous product feed U (page links exist); similar products U; recently viewed P; Shop the Look U |
| Search | Autocomplete U; trending searches U; recent searches U; Arabic/English normalization P; Arabizi/transliteration U; typo tolerance U; search corrections U; seller/category suggestions U; visual search U |
| Categories | Full department browsing P; category-specific landing pages P |
| Filters | Dynamic category facets U; multiselect filters U; sorting P |
| Product | Full media gallery P; color/size selectors P; size guides U; verified customer reviews U; photo reviews U; recommendations U; delivery/returns details B |
| Shopping | Quick add U (PDP add exists); persistent cart P; wishlist P; guest checkout B; live checkout integration B; real orders B; order tracking B; returns workflow B |
| Sellers | Rich storefront P; seller ratings U; following U |
| Promotions | Coupons U; sales campaigns U; bundle offers U |
| Account | Shopping preferences U; saved addresses U; notifications U |
| Platform | Full Arabic RTL P; responsive PWA P; accessibility P; performance U; security P |
