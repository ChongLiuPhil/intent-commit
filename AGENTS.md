# AGENTS — Intent Commit repository contract

[English](AGENTS.md) | [中文](AGENTS.zh-CN.md)

## Canonical authority

Repository state outranks chat/model memory. Use `START_HERE.md` and the AHICP context interface for selective routing.

Intent Commit has domain-specific authority rather than a duplicated research core:

- `docs/spec-v1.0.md`: stable Protocol 1.0 interoperability contract;
- `docs/interoperability.md` + frozen vectors: cross-implementation verification;
- `docs/agent-spec.md`: reflective-agent contract;
- `docs/federation.md`: federation semantics;
- `docs/argument-structure.md`: author-approved public argument-map semantics;
- packages/tests: implementation and conformance evidence.

## Human authorization invariant

AI may help reflect, clarify, test, or draft. It must not silently create human commitments. Room commitment, external publication, federation publication, retraction/revision, provenance assertions, and argument-map publication remain separate human authorization acts.

Changes to Protocol 1.0 semantics, canonicalization, authorship/approval boundaries, public-action semantics, repository visibility, or deployment/publication state require explicit maintainer authority.

## Security sync note

`SECURITY.md` currently contains legacy MVP statements that do not fully align with current `docs/deployment.md` and v1.0 implementation documentation. Treat this as a synchronization defect, not as permission to silently pick the more convenient description. Reconcile it in a dedicated review.

## Publication

The repository source is public, but no hosted provider is inferred. PPF records Web deployment as disabled/not-authorized with provider `null`. Deployment instructions are not provider actual-state evidence. `website.yaml publish=false` remains the Vault/homepage-change boundary.
