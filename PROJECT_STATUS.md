# Project Status — Intent Commit

Last updated: 2026-09-21

## Current protocol/product state

- Repository visibility: public.
- Protocol: Intent Commit Protocol 1.0, stable.
- Package/workspace version: 1.0.0.
- Normative protocol authority: `docs/spec-v1.0.md` plus `packages/protocol/`.
- Core invariant: explicit human approval before COMMITTED.
- Public-act authorization layers remain distinct.
- Main CI: healthy at the latest pre-adoption main run.
- GitHub Releases observed during Stack audit: none.
- GitHub Pages / standalone Web provider: none observed.
- Academic Vault/homepage metadata: `website.yaml publish=false`; this does not revoke already-public source/legacy representation.

## Current objective

Preserve Protocol 1.0 interoperability and human-approval boundaries while keeping the reference implementation, federation objects, verifier, reflective-agent guidance, deployment documentation, and security claims synchronized.

## Stack adoption

- Current AHICP/PPF/Vault/Starter functional mapping: in review until PR CI passes; if this file is read from `main`, the adoption has been merged.
- No product version, protocol version, provider, repository visibility, or public-authorization change is implied by Stack adoption.

## Blockers

- None introduced by Stack adoption.

## Pending maintainer decisions

- Reconcile `SECURITY.md` with the current implementation/deployment model before treating either document as a complete current threat/security description.
- Any Protocol 1.x/2.x semantic contract change.
- Any standalone public Web provider/deployment.
- Any package/GitHub Release action not separately authorized.

## Synchronization defects

- **SECURITY-DOCUMENTATION-DRIFT:** `SECURITY.md` still describes an older MVP with no authentication/database and localStorage committed messages, while `docs/deployment.md` describes account/session and SQLite persisted-data concepts. This audit records the discrepancy but does not silently rewrite the security boundary.
