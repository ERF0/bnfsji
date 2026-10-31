# Frontend decisions

This is the canonical index for frontend product and engineering decisions.

- [Research-backed frontend decisions](frontend-research-decisions.md)
- [Product decision register](approval/decision-register.md)
- [Architecture review](approval/architecture-review.md)

## Completion decisions

- Do not expose checkout until an authoritative order contract, payment provider, delivery operations, and legal approvals exist.
- Do not present sample or locally persisted data as live commerce data.
- Preserve the existing React Router, Cloudflare Workers, and Supabase architecture; complete it in tested vertical slices.
- Treat hosted authentication and role journeys as integration-unverified until they run against a configured development Supabase project.
- Treat 401, 403, 404, and server failures as distinct recovery states with localized actions.
