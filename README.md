# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a person. It helps the speaker inspect and clarify what they are willing to mean; only explicitly human-approved content becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Optional public federation

[简体中文 README](README.zh-CN.md)

## v0.9: Claims & Argument Structure

v0.9 adds **author-approved fine-grained argument maps** for already-federated utterances.

A public statement can now have an internal structure such as:

```text
reason-1 --------supports-------> claim-1
objection-1 -----challenges-----> claim-1
qualification-1 -qualifies------> claim-1
```

Supported node kinds:

- `claim`
- `reason`
- `objection`
- `qualification`

Supported internal predicates:

- `supports`
- `challenges`
- `qualifies`

The crucial boundary is that an AI-generated structure is only a **private suggestion**. It is not stored as public discourse and does not become a federation object until the original human author reviews it, may edit it, and explicitly approves publication.

```text
Federated utterance
      ↓
Private AI structure suggestion
      ↓
Human review / editing
      ↓
Explicit approval
      ↓
Signed public argument map
```

With no OpenAI API key configured, demo mode makes no hidden inference: it returns one `claim` node containing the original committed statement and no edges.

## Core communication invariant

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

The protocol rejects:

```text
DRAFT → COMMITTED
```

The Reflective Agent follows one central rule:

> **Expand without inventing.**

Missing reasons, assumptions, commitments, or intentions should be surfaced as uncertainty or questions, not silently authored by the model.

## Public commitment layers

Intent Commit distinguishes several different public acts:

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Retraction / Revision
    ≠
Provenance Relation
    ≠
Argument-Map Publication
```

Changing the audience, changing a previous public stance, asserting a relation to another utterance, or publishing an internal argument structure each requires a new explicit human action.

## Federation v1.3

Federation uses a persistent Ed25519 instance identity. The current implementation verifies federation versions `1.0` through `1.3`.

Public object families:

```text
federated-committed-utterance
federated-retraction
federated-revision
federated-provenance-edge
federated-argument-map
```

Schemas:

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
packages/federation/schemas/provenance-edge.schema.json
packages/federation/schemas/argument-map.schema.json
```

See:

- `docs/federation.md`
- `docs/argument-structure.md`
- `docs/protocol-package.md`

## Three different graph layers

Intent Commit keeps three meanings separate.

Lifecycle:

```text
U1 → RETRACTION(U1)
U1 → REVISION(U1 → U2)
```

Cross-utterance provenance:

```text
U1 --cites------> U2
U1 --supports---> U2
U1 --challenges-> U2
```

Inside one utterance:

```text
reason-1 --supports--> claim-1
```

This distinction prevents a software implementation from treating “I revised my statement”, “my statement supports another statement”, and “this sentence is a reason for another sentence” as the same kind of relation.

## Argument-map rules

The server independently validates every public map:

- only the original author may publish it;
- the subject must already be federated;
- explicit `approved: true` is required;
- at least one `claim` is required;
- 1–32 nodes and at most 64 edges;
- unique node IDs;
- edges must reference existing, different nodes;
- `reason` nodes may only create `supports` edges;
- `objection` nodes may only create `challenges` edges;
- `qualification` nodes may only create `qualifies` edges;
- duplicate edges are rejected;
- one public argument map per federated utterance in v0.9.

The signed map is immutable. If the speaker changes the substantive utterance, the existing revision mechanism should produce a new committed/federated utterance, which may then receive its own map.

## Federation endpoints

Instance discovery:

```text
GET /.well-known/intent-commit
```

Public graph:

```text
GET /federation/graph
```

Signed utterance and relations:

```text
GET /federation/utterances/:messageId
GET /federation/utterances/:messageId/relations
```

Signed lifecycle/provenance/argument objects:

```text
GET /federation/events/:eventId
GET /federation/provenance/:edgeId
GET /federation/arguments/:mapId
```

Private argument suggestion:

```text
POST /api/rooms/:code/arguments/suggest
```

Author-approved argument publication:

```text
POST /api/rooms/:code/federation/arguments
```

Example:

```json
{
  "messageId": "message-id",
  "nodes": [
    { "id": "claim-1", "kind": "claim", "text": "..." },
    { "id": "reason-1", "kind": "reason", "text": "..." }
  ],
  "edges": [
    { "source": "reason-1", "target": "claim-1", "predicate": "supports" }
  ],
  "approved": true
}
```

## Reference client

On the signed-in author's own federated utterance, the web client exposes `Structure…`.

The flow is intentionally two-stage:

1. request a private structure suggestion;
2. inspect/edit the JSON and separately confirm public publication.

After publication, the message shows a stable **Argument map · signed** link instead of an editable structure.

The existing federation actions remain available: `Cite…`, `Support…`, `Challenge…`, `Retract`, and `Revise…`.

## Persistence and privacy boundary

Ordinary room persistence stores accounts, password hashes, hashed sessions, rooms, memberships, roles, and committed statements.

It does **not** store raw drafts, clarification text, Intent Cards, unapproved reformulations, or private AI argument suggestions as public discourse.

Public federation artifacts are stored separately:

```text
federation_publications  signed utterances
federation_events        signed retractions / revisions
provenance_edges          signed cross-utterance relations
argument_maps             signed intra-utterance structures
```

## Run locally

Requires Node.js **22.13+**.

```bash
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

Optional configuration:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
GITHUB_TOKEN=
FEDERATION_ENABLED=false
PUBLIC_BASE_URL=
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Docker:

```bash
docker compose up --build
```

SQLite and federation identity keys are persisted in the `intent_commit_data` volume.

## Development

```bash
npm test
```

The suite syntax-checks the server and browser client, then tests protocol transitions, account/session persistence, room governance, federation signatures, tamper detection, retraction/revision, provenance edges, argument-map validation/signing/uniqueness, demo suggestion non-invention, GitHub adapter behavior, and publication audit invariants.

## Project structure

```text
packages/protocol/             transport-neutral protocol primitives
packages/federation/           Ed25519 federation primitives and schemas
packages/adapters-github/      GitHub Issues outbound adapter
public/                        reference web client
src/store.js                   accounts, rooms, memberships and messages
src/federation-publications.js signed utterance persistence
src/federation-events.js       retraction / revision persistence
src/provenance-edges.js        cross-utterance provenance persistence
src/argument-maps.js           signed argument-map persistence
src/argument-suggestions.js    private AI/demo structure suggestions
server.js                      HTTP API, auth, federation, adapters and SSE
test/                          protocol, persistence and federation tests
docs/                          philosophy, protocol, federation and deployment notes
```

## Current limits

v0.9 remains **verifiable outbound federation**, not a complete federated social network. It does not yet implement remote inbox delivery, remote following, ActivityPub compatibility, inbound federation, cross-instance identity binding, replay protection for remote delivery, signed correction events for argument maps, formal database migrations, rate limiting, password recovery, or multi-process realtime fan-out.

## License

MIT
