# Intent Commit Federation v1.2

v0.8 extends verifiable federation with a signed provenance / citation graph. Federation still does not implement a remote inbox, automatic delivery, following, or ActivityPub compatibility.

The central rule remains that public history is not silently rewritten and new public relations are not silently inferred. Utterances, lifecycle events, and provenance edges are separate signed objects.

## Public object model

```text
Federated Utterance
    ├── Lifecycle relation
    │     ├── retraction
    │     └── revision → replacement utterance
    │
    └── Provenance edges
          ├── cites → target utterance
          ├── supports → target utterance
          └── challenges → target utterance
```

A lifecycle relation describes how an author later positions themselves toward their earlier public utterance. A provenance edge describes how the author of the source utterance publicly positions that utterance relative to another public utterance.

## Consent and authority

Room commitment, federation publication, lifecycle change, and provenance assertion are distinct acts.

Only the original human author may:

- federate their committed utterance;
- retract it;
- revise it;
- create a provenance edge whose source is that utterance.

Owners and moderators do not inherit authorship authority.

Both endpoints of a v1.2 provenance edge must already be independently federated. Creating an edge therefore never publishes a room-only message as a side effect.

## Instance identity

An enabled instance maintains a persistent Ed25519 key pair, normally at:

```text
data/federation-private.pem
data/federation-public.pem
```

Discovery:

```text
GET /.well-known/intent-commit
```

The descriptor exposes the public key, federation version, supported historical versions, and public endpoint templates. Federation v1.2 continues to verify v1.0 and v1.1 utterances and lifecycle artifacts.

## Federation configuration

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Use HTTPS and a stable `PUBLIC_BASE_URL` in production.

## Utterance publication

```text
POST /api/rooms/:code/federation/publish
```

Canonical URI:

```text
https://intent.example.org/federation/utterances/<messageId>
```

Public read:

```text
GET /federation/utterances/:messageId
```

## Retraction and revision

Retraction:

```text
POST /api/rooms/:code/federation/retract
```

Revision:

```text
POST /api/rooms/:code/federation/revise
```

A revision replacement must first pass through the normal reflective workflow, become `COMMITTED`, and receive its own federation publication approval.

Lifecycle invariants remain:

- at most one direct retraction-or-revision event per utterance;
- no self-revision;
- no revision to an already retracted replacement;
- no revision cycles.

Public lifecycle event:

```text
GET /federation/events/:eventId
```

## Provenance graph

The v1.2 predicate vocabulary is deliberately small:

```text
cites
supports
challenges
```

Create a signed edge:

```text
POST /api/rooms/:code/federation/provenance
```

Example:

```json
{
  "sourceMessageId": "source-message-id",
  "targetMessageId": "target-message-id",
  "predicate": "supports",
  "note": "Optional public explanation",
  "approved": true
}
```

The authenticated user must be the original author of the source utterance. The server verifies that both source and target already have federation publication records.

Edge invariants:

- source and target must differ;
- predicate must be one of the three defined predicates;
- identical `(source, target, predicate)` edges are rejected as duplicates;
- optional notes are public, signed, and limited to 1000 characters;
- modifying any signed field invalidates verification.

Public signed edge:

```text
GET /federation/provenance/:edgeId
```

Whole same-instance graph:

```text
GET /federation/graph
```

Relations around one utterance:

```text
GET /federation/utterances/:messageId/relations
```

This response contains lifecycle relations plus incoming and outgoing provenance edges.

## Schemas and reusable code

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
packages/federation/schemas/provenance-edge.schema.json
packages/federation/index.js
```

The signing layer uses deterministic JSON serialization and the instance Ed25519 identity.

## Persistence

```text
federation_publications  signed utterances
federation_events        signed retractions / revisions
provenance_edges          signed cites / supports / challenges edges
```

These public artifacts are distinct from private reflection state. Raw drafts, clarifications, Intent Cards, and unapproved reformulations are not placed in the federation graph.

## Security scope

v0.8 only creates provenance edges between utterances already federated by the same instance. The server does not fetch arbitrary remote URLs and does not accept inbound federation payloads. This avoids introducing SSRF, remote spam, replay handling, remote identity binding, inbound moderation, and delivery retry semantics before cross-instance trust rules are defined.

Back up the private key securely: losing it means the instance cannot continue signing as the same federation identity.
