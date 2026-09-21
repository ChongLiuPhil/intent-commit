# START HERE — Intent Commit repository entry

[English](START_HERE.md) | [中文](START_HERE.zh-CN.md)

This is the zero-context entry for maintaining the Intent Commit protocol and reference implementation.

## Minimum read order

1. `AHICP_MANIFEST.yaml`
2. `AHICP_CONTEXT_INTERFACE.yaml`
3. `PROJECT_STATUS.md`
4. `AGENTS.md`
5. classify the task and read only the task-relevant protocol, agent, federation, implementation, security, or publication authorities

## Authority map

- stable Protocol 1.0 contract: `docs/spec-v1.0.md`
- interoperability / frozen vectors: `docs/interoperability.md` + `test-vectors/v1.0.json`
- reflective-agent behavior: `docs/agent-spec.md`
- federation: `docs/federation.md`
- author-approved argument structure: `docs/argument-structure.md`
- reference packages/implementation: `packages/`, `server.js`, `src/`
- deployment guidance: `docs/deployment.md`
- repository operational resume: `PROJECT_STATUS.md`

Protocol authorization boundaries outrank implementation convenience.

## Publication boundary

The source repository is public. There is no observed GitHub Pages or hosted provider in repository actual state. Deployment documentation describes how the reference client can be deployed; it is not evidence that a provider is currently active.

`website.yaml publish=false` does not revoke the project's existing Academic Vault legacy representation, but it grants no new standalone-site or future homepage publication authorization.
