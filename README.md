# Intent Commit

**Think before you commit.**

Intent Commit is an open protocol and reference client for **AI-mediated reflective human communication**. AI does not speak on behalf of a human. It helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.4: protocol + governance + deployment

v0.4 moves the project beyond a single chat implementation:

- a transport-neutral `packages/protocol` module;
- protocol version `1.0`;
- machine-testable message-state transitions;
- JSON Schemas for Intent Cards and committed messages;
- interoperable committed-message envelopes for adapters;
- `owner / moderator / member` room roles;
- owner-controlled moderator promotion/demotion;
- ownership transfer;
- role-constrained member removal;
- Docker and Docker Compose deployment;
- persistent SQLite accounts, rooms, memberships, roles, sessions, and committed history;
- SSE live synchronization for the reference client.

## Core invariant

A conforming client must not treat a raw draft as public speech:

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

The reusable protocol lives in:

```text
packages/protocol/
```

It exports state-transition rules, room-role capabilities, Intent Card validation, and committed-message envelope creation/validation.

Schemas:

- `packages/protocol/schemas/intent-card.schema.json`
- `packages/protocol/schemas/committed-message.schema.json`

Reference server adapter endpoint:

```text
GET /api/rooms/:code/protocol/messages
```

See [`docs/protocol-package.md`](docs/protocol-package.md).

## Room governance

Roles are deliberately narrow:

- **owner** — may promote/demote moderators, remove non-owners, and transfer ownership;
- **moderator** — may remove ordinary members only;
- **member** — participates in the room but has no moderation authority.

The owner cannot leave a populated room until ownership has been transferred. Governance never exposes or modifies another participant's private reflection workspace.

## Run locally

Requires Node.js **22.13+**.

```bash
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

The first start creates `data/intent-commit.sqlite`. The `data/` directory is gitignored.

Without an API key, the project uses a deterministic demo reflector. To enable OpenAI, configure the server-side environment:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
```

For an HTTPS deployment, set `COOKIE_SECURE=true`.

## Docker

```bash
docker compose up --build
```

SQLite is persisted in the `intent_commit_data` volume. The production `Dockerfile` defaults to a secure cookie and stores the database under `/app/data`.

See [`docs/deployment.md`](docs/deployment.md).

## API

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

Protocol adapters:

- `GET /api/rooms/:code/protocol/messages`

Reflection:

- `POST /api/reflect`

## Persistence and privacy boundary

Stored in SQLite: accounts, password hashes, hashed sessions, rooms, memberships, roles, and committed statements.

Not stored as room discourse: raw drafts, clarification text, Intent Cards, and unapproved reformulations. When an external LLM is enabled, private reflective inputs are processed by that provider.

See [`docs/persistence.md`](docs/persistence.md), [`docs/privacy.md`](docs/privacy.md), and [`docs/multi-user.md`](docs/multi-user.md).

## Development

```bash
npm test
```

Tests cover protocol transitions, message-envelope interoperability, password hashing, session revocation, account-based membership, explicit approval, moderation authority, ownership transfer, and persistence across a database reopen.

## Project structure

```text
packages/protocol/    transport-neutral protocol primitives and schemas
public/               reference web client
src/reflector.js      Intent Card normalization and demo reflector
src/openai.js         OpenAI reflection adapter
src/store.js          SQLite accounts, sessions, rooms, roles and messages
server.js             HTTP API, auth cookies, governance and SSE transport
test/                 protocol, reflector and persistence/governance tests
docs/                 philosophy, protocol, privacy, persistence and deployment notes
```

## Current limits

v0.4 is deployable but not yet a hardened public platform. It does not yet include password recovery, rate limiting, audit logs for moderation actions, CSRF tokens beyond SameSite cookies, multi-process realtime fan-out, or formal database migration tooling.

## License

MIT
