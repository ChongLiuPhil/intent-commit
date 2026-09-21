# START HERE — Intent Commit repository entry

[English](START_HERE.md) | [中文](START_HERE.zh-CN.md)

This is the zero-context entry for maintaining the Intent Commit repository.

## Required read order

1. `AHICP_MANIFEST.yaml`
2. `AHICP_CONTEXT_INTERFACE.yaml`
3. `PROJECT_STATUS.md`
4. `AGENTS.md`
5. classify the task as PROTOCOL, AGENT, FEDERATION, SECURITY, IMPLEMENTATION, GOVERNANCE, or PUBLICATION
6. read only the task-relevant authority declared by the context interface

## Authority map

- stable interoperability contract: `docs/spec-v1.0.md` + `packages/protocol/`
- reflective-agent behavior: `docs/agent-spec.md`
- interoperability/verifier: `docs/interoperability.md` + `packages/verifier/`
- federation: `docs/federation.md` + `packages/federation/`
- argument structure: `docs/argument-structure.md`
- security/trust boundary: `SECURITY.md` plus current implementation/deployment facts
- deployment guidance: `docs/deployment.md`
- operational resume: `PROJECT_STATUS.md`

Do not create a second Content Core that copies the stable protocol or product docs.

## Publication boundary

The source repository is public, but no standalone Web provider or GitHub Pages deployment is observed. `docs/deployment.md` describes how the reference implementation can be deployed; it is not evidence that a current production provider exists. `website.yaml publish=false` prevents metadata alone from authorizing a new standalone site or future Academic Vault/homepage changes.

## Known security documentation drift

`SECURITY.md` and `docs/deployment.md` currently describe different product generations. Treat `PROJECT_STATUS.md` as the record of that unresolved synchronization defect; do not silently choose one as a complete current threat model.
