# Decision log

## 2026-10-26 — Arabic catalog search

**Problem →** A buyer entering a common unvowelled Arabic spelling can miss a matching product; `%` and `_` can unintentionally broaden results.

**Evidence →** The live catalog RPC in migration 005 used direct `ILIKE` patterns. The catalog route and search URL already work. PostgreSQL has the needed native string functions. The Jordan SHEIN dresses page makes category discovery a relevant benchmark, but its search behavior was not tested.

**Options →** Keep substring `ILIKE`; add a hosted search engine; normalize and match literal text in the existing RPC.

**Choice →** Use a small immutable normalization function and literal substring matching in the existing RPC. Rank exact and prefix product titles before other title and shop matches for default search sort.

**Tradeoff →** This remains a database scan, as the previous `ILIKE` query was. It does not claim Arabizi, typo correction, synonym expansion, or measured relevance. Benchmark real inventory before deciding on trigram indexes or a dedicated index.

**Rollback →** Apply a new forward migration restoring the previous RPC body; do not edit an applied migration. Query URL and RPC signature are unchanged.

**Test →** PGlite migration/RLS test covers Arabic normalization, relevance, literal wildcard input, active stock and existing price rules; Node suite and Worker build pass. Hosted Supabase remains unverified.
