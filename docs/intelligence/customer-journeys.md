# Customer journeys

Current state checked 2026-10-26 from routes and tests. Actions below are flow steps, not measured tap counts.

| Task | Current Bnafsaji path | Main friction / next check |
|---|---|---|
| Find a product | `/ar` or `/en` → search field → shareable query URL → product card → PDP. | Search previously treated `%` and `_` as wildcards and ignored common Arabic spelling differences; migration 202610260001 addresses these locally. Live inventory relevance remains unmeasured. |
| Narrow a category | Category link → price bounds and sort → product card. | Live size/color/style facets are unavailable; the richer controls belong to a clearly labeled local showcase. Requires a real inventory attribute contract and database-backed facets. |
| Save and return | Product card/PDP → wishlist; guest IDs persist on device. | Cross-device requires configured Auth and hosted RLS verification. |
| Buy | PDP variant → local cart → refreshed price and possible private quote. | Order placement remains disabled pending verified payment, phone, delivery and legal operations. |

Check these at 390px and desktop in Arabic RTL and English LTR with real active products once a development Supabase project is connected. Review keyboard focus, screen reader labels, mixed-script names, empty results, stale prices and back-navigation context.
