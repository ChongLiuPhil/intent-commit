# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a human. It helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.5: first external adapter

v0.5 proves that the Intent Commit protocol can leave its own reference client without collapsing its consent model.

The first adapter publishes an already-COMMITTED message to a GitHub Issue or Pull Request conversation comment.

Key rules:

- only protocol-valid `COMMITTED` messages are eligible;
- room commitment does **not** automatically authorize a larger audience;
- the original human author must explicitly approve the external publication again;
- room owners and moderators cannot export someone else's statement;
- GitHub credentials remain server-side;
- successful exports are written to a persistent SQLite audit table;
- duplicate publication of the same message to the same target is rejected;
- raw drafts, clarification text and Intent Cards never enter the adapter.

The repository includes a public dogfooding target at Issue `#1` for future end-to-end testing.

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

## Protocol package

The transport-neutral protocol lives in:

```text
packages/protocol/
```

It exports state transitions, room-role capabilities, Intent Card validation, and committed-message envelope creation/validation.

Schemas:

- `packages/protocol/schemas/intent-card.schema.json`
- `packages/protocol/schemas/committed-message.schema.json`

Reference protocol endpoint:

```text
GET /api/rooms/:code/protocol/messages
```

See [`docs/protocol-package.md`](docs/protocol-package.md).

## GitHub Issues adapter

Reusable adapter package:

```text
packages/adapters-github/
```

Server configuration:

```env
GITHUB_TOKEN=...
```

The token is read only by the Node server. Do not expose it to browser JavaScript or commit it to Git.

Publish endpoint:

```text
POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish
```

Body:

```json
{
  "repository": "owner/repo",
  "messageId": "committed-message-id",
  "approved": true
}
```

Audit endpoint:

```text
GET /api/rooms/:code/exports
```

See [`docs/adapters/github-issues.md`](docs/adapters/github-issues.md), [`docs/adapters/consent-model.md`](docs/adapters/consent-model.md), and [`docs/adapters/security.md`](docs/adapters/security.md).

## Room governance

Roles remain deliberately narrow:

- **owner** — may promote/demote moderators, remove non-owners, and transfer ownership;
- **moderator** — may remove ordinary members only;
- **member** — participates in the room but has no moderation authority.

Governance never exposes or modifies another participant's private reflection workspace.

## Run locally

Requires Node.js **22.13+**.

```bash
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

The first start creates `data/intent-commit.sqlite`. The `data/` directory is gitignored.

Optional server-side configuration:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
GITHUB_TOKEN=
```

For an HTTPS deployment, set `COOKIE_SECURE=true`.

## Docker

```bash
docker compose up --build
```

SQLite is persisted in the `intent_commit_data` volume. See [`docs/deployment.md`](docs/deployment.md).

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

Protocol and adapters:

- `GET /api/rooms/:code/protocol/messages`
- `POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish`
- `GET /api/rooms/:code/exports`

Reflection:

- `POST /api/reflect`

## Persistence and privacy boundary

Stored in SQLite: accounts, password hashes, hashed sessions, rooms, memberships, roles, committed statements, and successful external-publication audit records.

Not stored as room discourse: raw drafts, clarification text, Intent Cards, and unapproved reformulations. When an external LLM is enabled, private reflective inputs are processed by that provider.

External publication is treated as a separate consent event because changing the audience changes the practical consequences of an utterance.

## Development

```bash
npm test
```

Tests cover protocol transitions, message-envelope interoperability, password hashing, session revocation, membership, explicit approval, governance, persistence, GitHub adapter formatting/request construction, and external-publication audit deduplication.

## Project structure

```text
packages/protocol/          transport-neutral protocol primitives and schemas
packages/adapters-github/   GitHub Issues outbound adapter
public/                     reference web client
src/reflector.js            Intent Card normalization and demo reflector
src/openai.js               OpenAI reflection adapter
src/store.js                SQLite accounts, sessions, rooms, roles and messages
src/external-publications.js external publication audit store
server.js                   HTTP API, auth, governance, adapters and SSE transport
test/                       protocol, adapter, reflector and persistence tests
docs/                       philosophy, protocol, privacy, deployment and adapter notes
```

## Current limits

v0.5 is still a reference implementation. The GitHub bridge is outbound-only and currently requires a server-configured token. The project does not yet include password recovery, rate limiting, formal database migrations, multi-process realtime fan-out, per-room provider credentials, or inbound federation/webhook semantics.

## License

MIT
