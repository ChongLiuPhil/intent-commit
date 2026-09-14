# Interoperability and verification

Intent Commit v1.0 includes an implementation-independent conformance surface.

## Frozen vector

`test-vectors/v1.0.json` contains:

- the canonicalization algorithm identifier;
- a key-ordering canonicalization example;
- a fixed Ed25519 public test key;
- a signed Federation 1.3 utterance;
- the exact canonical unsigned payload expected before verification.

The key is a public test fixture, not a deployment identity.

## Standalone verifier

The repository includes `@intent-commit/verifier`.

```bash
npm run verify -- object.json public-key.pem
```

Exit status:

- `0`: valid
- `1`: parsed but invalid
- `2`: usage, I/O, or parsing error

The verifier dispatches by Intent Commit object `type` and supports Protocol 1.0 committed messages plus signed Federation 1.0–1.3 object families.

## Implementing another language

A conforming Python, Rust, Go, Java, or other implementation does not need the Intent Commit server. It needs to reproduce `IC-C14N/1`, parse Ed25519 public keys, enforce the relevant object semantics, and pass the frozen vectors.

Do not treat signature validity as proof that a human personally typed every character. The signature proves that the publishing Intent Commit instance attested to the signed object; the protocol's human-approval semantics are enforced by the authoring workflow and server authorization boundary.
