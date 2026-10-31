# Evidence register

Checked 2026-10-26. `OBSERVED` means reproduced in this repository or directly retrieved; `DOCUMENTED` means the source states a behavior; neither proves production operation.

| Claim | Source | Method | Confidence | Decision |
|---|---|---|---|---|
| Live catalog search uses substring `ILIKE`, with `%` and `_` interpreted as patterns. | [migration 005](../../supabase/migrations/202610220005_product_variants.sql) | Source inspection and PGlite baseline | OBSERVED | Replace pattern matching with literal normalized substring lookup. |
| Catalog UI already submits bilingual GET queries and keeps category/price state. | [catalog route](../../apps/web/app/routes/catalog.jsx) and [browser test](../../apps/web/e2e/storefront.spec.js) | Source inspection and existing tests | OBSERVED | Keep the current route and improve its database query. |
| Jordan-facing SHEIN dresses page shows size, color, style and JOD price facets. | [SHEIN Jordan dresses](https://jo.shein.com/women-dresses-c-1727.html) | Public HTML retrieval | DOCUMENTED | Prioritize genuine catalog filters when data contract exists. |
| PostgreSQL provides `regexp_replace`, `translate` and `strpos`. | [PostgreSQL string functions](https://www.postgresql.org/docs/18/functions-string.html) | Official documentation | DOCUMENTED | Use built-in text functions; no search service dependency. |
| React Router GET forms navigate with URL search parameters. | [React Router navigation](https://reactrouter.com/start/framework/navigating) | Official documentation | DOCUMENTED | Preserve shareable search URLs. |
| WCAG 2.2 AA includes a 24 CSS pixel minimum target criterion with exceptions. | [WCAG 2.2](https://www.w3.org/TR/wcag/) | Official standard | DOCUMENTED | Include target-size review in later browser accessibility pass; no compliance claim yet. |
| Hosted catalog, inventory and commerce readiness. | [launch readiness](../release/LAUNCH_READINESS.md) | Repository release register and absent local service configuration | UNKNOWN | Keep checkout disabled and live-data verification open. |

No customer interviews, Jordan-wide demand measurement, hosted Supabase query, or live competitor transaction was performed.
