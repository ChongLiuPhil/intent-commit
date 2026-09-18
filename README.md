# Intent Commit

[English](README.md) | [中文](README.zh-CN.md)

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI may help a person inspect and clarify meaning, but only explicit human approval creates a committed public statement.

> Private draft → Reflect → Clarify → Approve → Commit → Optional public publication

## v1.0: Protocol Stabilization

v1.0 freezes the core interoperability contract instead of adding another social feature.

The stable protocol now includes:

- Protocol version `1.0` with the human-approval state invariant;
- `@intent-commit/protocol` version `1.0.0`;
- deterministic canonical JSON, `IC-C14N/1`;
- frozen cross-implementation test vectors;
- a standalone verifier that does not require the Intent Commit server;
- Federation 1.0–1.3 verification compatibility;
- a written stability policy for future protocol changes.

See `docs/spec-v1.0.md` and `docs/interoperability.md`.

## Core invariant

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

The protocol rejects direct `DRAFT → COMMITTED` transitions. Reflective agents follow **Expand without inventing**: missing reasons or commitments are surfaced as uncertainty or questions, not silently authored by AI.

## Independent verification

Canonicalization is now part of the protocol rather than an implementation detail:

```text
object → IC-C14N/1 → UTF-8 bytes → Ed25519 verify
```

Run the standalone verifier with:

```bash
npm run verify -- object.json public-key.pem
```

The frozen conformance vector is at `test-vectors/v1.0.json`.

## Public object layers

Intent Commit keeps distinct acts distinct:

```text
Room Commit
External Publication
Federation Publication
Retraction / Revision
Provenance Relation
Argument-Map Publication
```

One authorization never silently grants another.

Federation 1.3 object families remain:

```text
federated-committed-utterance
federated-retraction
federated-revision
federated-provenance-edge
federated-argument-map
```

## Packages

```text
packages/protocol/        stable Protocol 1.0 primitives + IC-C14N/1
packages/federation/      Ed25519 Federation 1.0–1.3 primitives
packages/verifier/        standalone object verifier
packages/adapters-github/ GitHub Issues outbound adapter
```

## Run locally

Requires Node.js 22.13+.

```bash
cp .env.example .env
npm start
```

Optional AI reflection uses `OPENAI_API_KEY`. Federation remains opt-in and requires a stable `PUBLIC_BASE_URL` and persistent Ed25519 identity.

## Development

```bash
npm test
```

The suite checks server/browser/verifier syntax, protocol transitions, persistence, governance, federation signatures, lifecycle relations, provenance, argument maps, non-invention behavior, and the v1.0 interoperability vectors.

## Specification

- `docs/spec-v1.0.md` — normative Protocol 1.0 contract
- `docs/interoperability.md` — verifier and language-implementation guidance
- `docs/federation.md` — Federation 1.3
- `docs/argument-structure.md` — author-approved claim structure

## Current scope

v1.0 stabilizes the protocol and outbound verification model. It is not yet a complete federated social network: inbound federation, remote delivery, cross-instance identity binding, replay protection, formal migrations, rate limiting, password recovery, and multi-process realtime fan-out remain future work.

## License

MIT
