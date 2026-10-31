# Frontend blockers

This is the canonical blocker index. Detailed evidence and ownership are maintained in:

- [Frontend integration blockers](frontend-integration-blockers.md)
- [Launch readiness gates](release/LAUNCH_READINESS.md)
- [Feature acceptance matrix](approval/feature-acceptance-matrix.md)

## Active external blockers

| Blocker | Prevents | Required resolution |
|---|---|---|
| No configured development Supabase project or role accounts | Hosted catalog, authentication, MFA, seller, admin, owner, storage, and cross-device acceptance | Apply migrations to a development project and execute the role-specific browser journeys with non-production accounts. |
| No authoritative order, return, refund, or support contracts | Checkout, order history, returns, moderation, and support UI | Approve models, permissions, state transitions, and audit requirements before building user-facing flows. |
| Payment and buyer-verification providers are not approved/configured | Payment and live transaction flows | Complete provider qualification, credentials, webhook design, and legal/security review. |
| Delivery coverage and operating rules are unapproved | Truthful checkout delivery promises | Approve coverage, fee ownership, failure handling, and operational process. |
| Public policy/help copy is unapproved | Policy, help, and legal information routes | Supply approved Arabic and English content with ownership and review dates. |

These are not frontend coding placeholders. Implementing around them would create fake commerce behavior or invent business-critical requirements.
