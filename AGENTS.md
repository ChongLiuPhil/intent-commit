# AGENTS — Intent Commit repository contract

[English](AGENTS.md) | [中文](AGENTS.zh-CN.md)

## Authority

Repository state outranks chat/model memory. Use `START_HERE.md` and `AHICP_CONTEXT_INTERFACE.yaml` for selective routing.

Intent Commit uses layered product authority:

- `docs/spec-v1.0.md` + `packages/protocol/`: stable Protocol 1.0 interoperability contract;
- `docs/agent-spec.md`: reflective-agent behavior;
- `docs/federation.md` + `packages/federation/`: federation contracts;
- `docs/argument-structure.md`: author-approved argument-map semantics;
- `SECURITY.md` + current implementation/deployment facts: security/trust boundary;
- code/tests: reference implementation behavior subject to the protocol contract.

Do not let implementation behavior silently redefine Protocol 1.0. Do not let reflective-agent prose invent commitments beyond explicit human approval.

## Human/maintainer decisions

AI may analyze, draft, test, and prepare PRs. Changes to Protocol 1.0 semantics, approval/commit invariants, public-act authorization boundaries, federation object contracts, security/trust boundaries, publication state, repository visibility, or release policy require explicit maintainer authority.

## Publication

The repository source is already public. No standalone Web provider or Pages deployment is currently recorded. `docs/deployment.md` is guidance, not provider actual state. `website.yaml publish=false` does not revoke public source or legacy homepage representation; it prevents new standalone-site or future homepage publication changes from being inferred.

## Stack

AHICP uses a lightweight product-protocol functional mapping. PPF records lifecycle boundaries only. Do not install a research manuscript Core/Framework tree for template symmetry.

## Known synchronization defect

`SECURITY.md` appears stale relative to deployment/current server concepts. Preserve the discrepancy until a deliberate security review reconciles the docs with the implementation.
