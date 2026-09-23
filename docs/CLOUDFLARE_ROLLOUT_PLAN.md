# Cloudflare rollout plan — management-only

Status: **planning only**. The repository is already public source; this plan does not infer or authorize a public Web deployment.

## Current-state preservation
- Preserve the public source repository and existing package/protocol release semantics.
- No standalone production Web provider is treated as verified by this plan.
- Do not change repository visibility, package releases, deployment documentation, or canonical identity.

## Target management state
- Target provider for any future standalone Web surface: Cloudflare Workers / Static Assets.
- Planned Worker: `intent-commit`.
- Target Web visibility: restricted by default despite public source.
- Reader policy reference: `shared-reader-access`.
- Preview visibility: private; previews disabled until Access acceptance.
- Production branch: `main`; commit-triggered only; no scheduled polling.
- Public bypass: disabled; no custom domain selected.
- Paid services: not authorized.

## Content/build boundary
This phase does not select or publish protocol docs, server application output, packages, examples, public assets, or other project content. Existing `publishing.yaml`, `website.yaml`, application/server configuration, and deployment guide remain unchanged. A later phase must separately identify whether a static directory or application Worker is appropriate and approve its build/output contract.

## Manual/provider gates
Cloudflare login/MFA, Access baseline, reader approval, GitHub App authorization, choice of static-vs-application delivery, Worker/Builds reconciliation, runtime verification, and any final Web release/cutover remain separate gates.

## Rollback
No provider state is changed here. Repository rollback is an ordinary revert PR. No paid upgrade, DNS change, or publication transition is authorized.
