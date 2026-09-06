# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a human. It helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.7: signed retraction and revision

v0.7 gives a speaker a verifiable way to change their public position **without rewriting the historical record**.

A federated utterance remains an immutable signed artifact. The original author may later publish a second signed event:

```text
Federated utterance U1
        ↓
        ├── RETRACTION(U1)
        └── REVISION(U1 → U2)
```

`U2` is not silently created by the revision operation. It must first go through the normal reflective workflow, become `COMMITTED`, receive a separate federation-publication approval, and obtain its own signed canonical URI.

Key invariants:

- only the original human author may retract or revise their federated utterance;
- a room owner or moderator cannot do this for another person;
- the original signed utterance is never edited in place;
- one utterance may have at most one direct retraction-or-revision relation;
- a revision cannot point to itself;
- a revision cannot point to an already retracted replacement;
- revision chains cannot form cycles;
- relation events are independently signed with the instance Ed25519 identity;
- federation v1.1 continues to verify v1.0 utterances published by v0.6.

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

Intent Commit distinguishes several different acts of authorization:

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Federation Retraction / Revision
```

Changing the audience or changing a previously public commitment requires a new explicit human action.

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
```

See [`docs/protocol-package.md`](docs/protocol-package.md) and [`docs/federation.md`](docs/federation.md).

## Federation v1.1

Federation remains disabled by default. An enabled instance maintains a persistent Ed25519 identity and exposes its public verification key at:

```text
GET /.well-known/intent-commit
```

Public signed utterance:

```text
GET /federation/utterances/:messageId
```

Public relation discovery:

```text
GET /federation/utterances/:messageId/relations
```

Public signed relation event:

```text
GET /federation/events/:eventId
```

Authenticated room federation state:

```text
GET /api/rooms/:code/federation
```

Publish an already committed message:

```text
POST /api/rooms/:code/federation/publish
```

Retract a federated utterance:

```text
POST /api/rooms/:code/federation/retract
```

Example body:

```json
{
  "messageId": "old-message-id",
  "approved": true,
  "reason": "Optional public reason"
}
```

Link an old utterance to an independently federated replacement:

```text
POST /api/rooms/:code/federation/revise
```

Example body:

```json
{
  "messageId": "old-message-id",
  "replacementMessageId": "new-message-id",
  "approved": true,
  "reason": "Optional public reason"
}
```

The reference client displays **Federated**, **Retracted**, and **Revised** states. On the signed-in author's own federated messages it exposes `Retract` and `Revise…` controls when no direct relation already exists.

## Federation configuration

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Use HTTPS and a stable `PUBLIC_BASE_URL` in production. The private key is the persistent identity of the instance and should be backed up securely.

## GitHub Issues adapter

The v0.5 outbound adapter remains available:

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

Optional server-side configuration:

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
```

A retraction therefore means:

> the author publicly records that they no longer endorse the earlier utterance.

It does **not** mean that the earlier utterance never existed or that copies held by other systems can be erased.

## Development

```bash
npm test
```

The test command syntax-checks the server and browser client before running the suite. Tests cover protocol transitions, federation signatures and tamper detection, retraction/revision signatures, relation uniqueness, revision-cycle prevention logic in the server path, account/session behavior, governance, persistence, the GitHub adapter, and publication audit invariants.

## Project structure

```text
packages/protocol/            transport-neutral protocol primitives and schemas
packages/federation/          Ed25519 utterance + relation signing / verification
packages/adapters-github/     GitHub Issues outbound adapter
public/                       reference web client
src/store.js                  SQLite accounts, rooms and committed messages
src/federation-identity.js    persistent instance Ed25519 identity
src/federation-publications.js signed public utterance persistence
src/federation-events.js      signed retraction / revision persistence
src/external-publications.js  external adapter audit store
server.js                     HTTP API, auth, federation, adapters and SSE
test/                         protocol, federation, adapter and persistence tests
docs/                         philosophy, protocol, federation and deployment notes
```

## Current limits

v0.7 is still **verifiable outbound federation**, not a full federated social network. It does not implement remote inbox delivery, remote following, ActivityPub compatibility, inbound federation, cross-instance identity binding, replay protection for remote deliveries, formal database migrations, rate limiting, password recovery, or multi-process realtime fan-out.

## License

MIT
