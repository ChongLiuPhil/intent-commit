# Project Status — Intent Commit

Last updated: 2026-09-21

## Current protocol/product state

- Repository visibility: public.
- Protocol: 1.0 Stable.
- npm/root package version: 1.0.0.
- Human-approval state invariant: DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED.
- Frozen conformance vector: `test-vectors/v1.0.json`.
- GitHub Releases observed during Stack audit: none.
- GitHub Pages / hosted provider observed: none.
- Academic Vault: existing legacy published representation noted by `website.yaml`; no new standalone-site/homepage authorization.

## Current objective

Preserve Protocol 1.0 interoperability and explicit human-authorization boundaries while evolving the reference implementation and optional federation features without silently widening public commitment.

## Stack adoption

- Current AHICP/PPF/Vault/Starter functional mapping: in review until PR validation passes; if this file is read from `main`, adoption has been merged.
- PPF distinguishes public source distribution from an active hosted Web deployment.

## Known synchronization defect

- `SECURITY.md` still states that the MVP has no authentication/authorization layer or database, while current `docs/deployment.md` documents account/session persistence in SQLite and production deployment requirements. This is pre-existing and requires a dedicated security-document reconciliation; Stack adoption does not rewrite it.

## Blockers

- No Stack-specific blocker.

## Pending maintainer decisions

- Any future Protocol major-version change.
- Any provider-backed public deployment.
- Any reconciliation that changes the actual security/threat boundary rather than only documentation.
- Any new GitHub/package release action not separately authorized.

## Synchronization defects

- SECURITY/deployment documentation mismatch noted above.
