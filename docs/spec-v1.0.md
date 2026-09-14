# Intent Commit Protocol 1.0

Status: **Stable**

This document defines the interoperability contract for Intent Commit Protocol 1.0. The reference server is one implementation, not the protocol itself.

## 1. Core invariant

A human-authored statement may enter committed discourse only after explicit human approval:

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

`DRAFT → COMMITTED` is invalid. Reflective agents may expose uncertainty, ambiguity, missing reasons, and possible interpretations, but MUST NOT silently invent facts, reasons, positions, emotions, or commitments.

## 2. Stable base object

A Protocol 1.0 committed message has:

- `protocol = "intent-commit"`
- `protocolVersion = "1.0"`
- `type = "committed-message"`
- `state = "COMMITTED"`
- stable message id
- room code
- human author id and display name
- final human-approved statement
- ISO-compatible commit timestamp

The JSON Schema in `packages/protocol/schemas/committed-message.schema.json` is normative together with this specification.

## 3. Authorization boundaries

The following acts are distinct and MUST NOT be inferred from one another:

```text
Room commitment
External publication
Federation publication
Retraction or revision
Cross-utterance provenance assertion
Argument-map publication
```

Each public act requires its own explicit authorization by the relevant human author.

## 4. Canonical serialization: IC-C14N/1

Signed Intent Commit objects use deterministic UTF-8 JSON bytes. Implementations MUST produce the same bytes as `canonicalizeJson()` in `@intent-commit/protocol`.

Rules:

1. Object keys are sorted ascending by UTF-16 code-unit order.
2. Array order is preserved.
3. No insignificant whitespace is emitted.
4. Strings, booleans, null, and finite JSON numbers use JSON lexical representation.
5. `undefined`, functions, symbols, bigint, and non-finite numbers are invalid.
6. The resulting string is encoded as UTF-8 before signing or verification.

The identifier for this algorithm is `IC-C14N/1`.

## 5. Federation compatibility

Protocol 1.0 currently recognizes Federation wire versions 1.0–1.3. Federation 1.3 adds signed argument maps but does not replace Protocol 1.0.

Signed object families are:

- `federated-committed-utterance`
- `federated-retraction`
- `federated-revision`
- `federated-provenance-edge`
- `federated-argument-map`

Ed25519 signatures cover the canonicalized object with `proof.signature` omitted while the other proof fields remain present.

## 6. Conformance

An independent implementation SHOULD:

- pass `test-vectors/v1.0.json` exactly;
- validate Protocol 1.0 committed messages;
- reproduce the canonical bytes in the vector;
- verify the frozen Ed25519 signed utterance;
- reject the same object after any signed field is modified.

Passing the vector establishes serialization/signature compatibility, not full product security.

## 7. Stability policy

Protocol 1.0 fields and semantics are frozen. Backward-compatible additions may be introduced without changing the major protocol version only when older implementations can safely ignore them. Any change that reinterprets authorship, approval, commitment, canonicalization, or existing required fields requires a new major protocol version.
