# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a human. It helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.6: verifiable federation

v0.6 adds **author-controlled, cryptographically verifiable federation** without turning every room message into a public object.

A committed room message becomes federated only after a second explicit approval by its original human author:

```text
COMMITTED in room
      ↓
Explicit federation approval
      ↓
Signed public canonical URI
```

Key properties:

- federation is disabled by default;
- only the original author may federate their committed statement;
- room owners and moderators cannot federate someone else's statement;
- each enabled deployment has a persistent Ed25519 instance identity;
- the public verification key is exposed through `/.well-known/intent-commit`;
- published utterances have stable canonical URIs;
- envelopes are signed and independently verifiable;
- tampering with the signed statement causes verification to fail;
- federation publication is persisted independently from room membership/history;
- deleting a local room cannot guarantee deletion of copies already fetched by other systems;
- v0.6 deliberately does not accept inbound federation or fetch arbitrary remote URLs.

## Core protocol invariant

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

The protocol explicitly rejects:

```text
DRAFT → COMMITTED
```

The Reflective Agent follows one central rule:

> **Expand without inventing.**

Missing reasons, assumptions, commitments, or intentions should be surfaced as uncertainty or questions, not silently authored by the model.

## Protocol and federation packages

Transport-neutral protocol primitives:

```text
packages/protocol/
```

Federation signing / verification primitives:

```text
packages/federation/
```

Federated utterance schema:

```text
packages/federation/schemas/federated-utterance.schema.json
```

See [`docs/protocol-package.md`](docs/protocol-package.md) and [`docs/federation.md`](docs/federation.md).

## Federation endpoints

Instance discovery:

```text
GET /.well-known/intent-commit
```

Public signed utterance:

```text
GET /federation/utterances/:messageId
```

Room federation state:

```text
GET /api/rooms/:code/federation
```

Original-author publication:

```text
POST /api/rooms/:code/federation/publish
```

Body:

```json
{
  "messageId": "committed-message-id",
  "approved": true
}
```

The reference client exposes **Publish to federation** only on the signed-in author's own committed messages when federation is enabled.

## Federation configuration

Federation is opt-in:

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Use HTTPS and a stable `PUBLIC_BASE_URL` in production. The private key is the persistent identity of the instance and should be backed up securely.

## GitHub Issues adapter

v0.5's first external adapter remains available:

```text
packages/adapters-github/
```

Configure server-side only:

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

The GitHub adapter and federation share the same audience principle: **room commitment does not automatically authorize publication to a larger audience**.

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

## API summary

Authentication:

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`

Rooms:

- `POST /api/rooms`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code`
- `GET /api/rooms/:code/events`
- `POST /api/rooms/:code/commit`
- `POST /api/rooms/:code/leave`

Governance:

- `PATCH /api/rooms/:code/members/:userId/role`
- `DELETE /api/rooms/:code/members/:userId`
- `POST /api/rooms/:code/ownership`

Protocol / publication:

- `GET /api/rooms/:code/protocol/messages`
- `GET /api/rooms/:code/federation`
- `POST /api/rooms/:code/federation/publish`
- `POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish`
- `GET /api/rooms/:code/exports`

Reflection:

- `POST /api/reflect`

## Persistence and privacy boundary

Stored in room persistence: accounts, password hashes, hashed sessions, rooms, memberships, roles, and committed statements.

Not stored as room discourse: raw drafts, clarification text, Intent Cards, and unapproved reformulations.

Federation publication is a separate public artifact created only after explicit author approval. Once published, its signed envelope is kept independently so the canonical URI remains verifiable even if local room state later changes.

## Development

```bash
npm test
```

The test command now syntax-checks the server and browser client before running the suite. Tests cover protocol transitions, signed federation verification/tamper detection, publication deduplication, password/session behavior, governance, persistence, the GitHub adapter, and publication audit invariants.

## Project structure

```text
packages/protocol/           transport-neutral protocol primitives and schemas
packages/federation/         Ed25519 federation signing / verification
packages/adapters-github/    GitHub Issues outbound adapter
public/                      reference web client
src/store.js                 SQLite accounts, rooms and committed messages
src/federation-identity.js   persistent instance Ed25519 identity
src/federation-publications.js signed public utterance persistence
src/external-publications.js external adapter audit store
server.js                    HTTP API, auth, federation, adapters and SSE
test/                        protocol, federation, adapter and persistence tests
docs/                        philosophy, protocol, federation and deployment notes
```

## Current limits

v0.6 is **verifiable outbound federation**, not a full federated social network. It does not yet implement remote inbox delivery, remote following, ActivityPub compatibility, signed retraction statements, inbound moderation, replay protection for remote deliveries, formal database migrations, rate limiting, password recovery, or multi-process realtime fan-out.

## License

MIT
