# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a human. It helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.8: signed provenance and citation graph

v0.8 turns federated utterances into a small, verifiable argument graph without asking AI to infer argumentative structure on the speaker's behalf.

An already-federated utterance may now publicly relate itself to another already-federated utterance:

```text
U1 --cites------> U2
U1 --supports---> U2
U1 --challenges-> U2
```

These edges are themselves signed public federation objects.

Key invariants:

- only the original human author of the **source** utterance may create an edge;
- a room owner, moderator, target author, or AI agent cannot attribute an edge to the source author;
- source and target must both already be federated, so graph creation never silently widens the audience of a private or room-only message;
- source and target must differ;
- the first graph vocabulary is deliberately limited to `cites`, `supports`, and `challenges`;
- identical `(source, target, predicate)` edges are deduplicated;
- optional edge notes are public and signed;
- tampering with an edge invalidates its Ed25519 signature;
- v0.8 federation 1.2 remains verification-compatible with earlier 1.0 and 1.1 artifacts.

## Two kinds of public relation

Intent Commit now distinguishes **lifecycle relations** from **argumentative provenance relations**.

Lifecycle:

```text
U1 → RETRACTION(U1)
U1 → REVISION(U1 → U2)
```

Provenance:

```text
U1 --cites/supports/challenges--> U2
```

A retraction says something about the author's later stance toward an earlier utterance. A provenance edge says something about how the author of one public utterance positions it relative to another public utterance.

Neither relation edits the original signed utterance in place.

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

Intent Commit distinguishes separate acts of authorization:

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Federation Retraction / Revision
    ≠
Provenance Assertion
```

Changing the audience, changing a previously public commitment, or asserting an argumentative relation requires a new explicit human action.

## Protocol and federation packages

Transport-neutral communication protocol:

```text
packages/protocol/
```

Federation signing / verification primitives:

```text
packages/federation/
```

Schemas:

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
packages/federation/schemas/provenance-edge.schema.json
```

See [`docs/protocol-package.md`](docs/protocol-package.md), [`docs/federation.md`](docs/federation.md), and [`docs/provenance.md`](docs/provenance.md).

## Federation v1.2 public endpoints

Instance discovery:

```text
GET /.well-known/intent-commit
```

Public signed utterance:

```text
GET /federation/utterances/:messageId
```

Lifecycle + provenance relations around one utterance:

```text
GET /federation/utterances/:messageId/relations
```

Public signed lifecycle event:

```text
GET /federation/events/:eventId
```

Public signed provenance edge:

```text
GET /federation/provenance/:edgeId
```

Whole public graph:

```text
GET /federation/graph
```

## Authenticated federation actions

Publish an already committed message:

```text
POST /api/rooms/:code/federation/publish
```

Retract it:

```text
POST /api/rooms/:code/federation/retract
```

Revise it toward another independently federated utterance:

```text
POST /api/rooms/:code/federation/revise
```

Create a signed provenance edge:

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

The reference client exposes `Cite…`, `Support…`, and `Challenge…` only on the signed-in author's own federated source utterances that have not been directly retracted or revised.

## Federation configuration

Federation remains opt-in:

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Use HTTPS and a stable `PUBLIC_BASE_URL` in production. The private key is the persistent identity of the instance and should be backed up securely.

## GitHub Issues adapter

The outbound GitHub adapter remains available:

```text
packages/adapters-github/
```

Configure its credential server-side only:

```env
GITHUB_TOKEN=...
```

Publish endpoint:

```text
POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish
```

External publication audit:

```text
GET /api/rooms/:code/exports
```

## Room governance

Roles remain deliberately narrow:

- **owner** — may promote/demote moderators, remove non-owners, and transfer ownership;
- **moderator** — may remove ordinary members only;
- **member** — participates but has no moderation authority.

Governance never exposes or modifies another participant's private reflection workspace.

## Run locally

Requires Node.js **22.13+**.

```bash
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

The first start creates the SQLite database under `data/`. Federation keys are also stored under `data/` when federation is enabled. The directory is gitignored.

## Docker

```bash
docker compose up --build
```

SQLite and federation identity keys are persisted in the `intent_commit_data` volume.

## Persistence and privacy boundary

Stored as ordinary room persistence: accounts, password hashes, hashed sessions, rooms, memberships, roles, and committed statements.

Not stored as room discourse: raw drafts, clarification text, Intent Cards, and unapproved reformulations.

Public federation artifacts are stored separately:

```text
federation_publications  signed utterances
federation_events        signed retractions / revisions
provenance_edges          signed cites / supports / challenges edges
```

Creating a graph edge never grants access to another participant's private reflective workspace.

## Development

```bash
npm test
```

The test command syntax-checks the server and browser client before running the suite. Tests cover protocol transitions, federation signatures and tamper detection, retraction/revision invariants, provenance signatures, self-edge rejection, graph direction indexes, edge deduplication, account/session behavior, governance, persistence, the GitHub adapter, and publication audit invariants.

## Project structure

```text
packages/protocol/             transport-neutral protocol primitives and schemas
packages/federation/           utterance, lifecycle, and provenance signing / verification
packages/adapters-github/      GitHub Issues outbound adapter
public/                        reference web client
src/store.js                   SQLite accounts, rooms and committed messages
src/federation-identity.js     persistent instance Ed25519 identity
src/federation-publications.js signed public utterance persistence
src/federation-events.js       signed retraction / revision persistence
src/provenance-edges.js        signed argument-graph edge persistence
src/external-publications.js   external adapter audit store
server.js                      HTTP API, auth, federation, adapters and SSE
test/                          protocol, federation, provenance and persistence tests
docs/                          philosophy, protocol, federation, provenance and deployment notes
```

## Current limits

v0.8 remains **same-instance verifiable federation**, not a full federated social network. Provenance targets must already be federated by the same instance. The server does not fetch arbitrary remote graph targets and does not yet implement remote inbox delivery, following, ActivityPub compatibility, cross-instance identity binding, replay protection for remote deliveries, formal database migrations, rate limiting, password recovery, or multi-process realtime fan-out.

## License

MIT
