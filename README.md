# Intent Commit

**Think before you commit.**

Intent Commit is an open-source reflective communication protocol and reference client. AI does not speak on behalf of a human. It helps the speaker inspect, clarify and explicitly approve what they are willing to mean before that statement becomes public.

> Private draft → Reflect → Clarify → Approve → Commit → Share

[简体中文 README](README.zh-CN.md)

## v0.3: persistent multi-user conversations

v0.3 turns the room prototype into a persistent account-based service:

- username/password accounts;
- passwords hashed with `scrypt` and random salts;
- revocable server-side sessions delivered in HttpOnly cookies;
- SQLite persistence using Node's built-in `node:sqlite`;
- durable rooms, memberships and committed history across restarts;
- a "Your rooms" lobby after login;
- live SSE synchronization for committed room state;
- private drafts remain outside the public room database;
- the server still refuses a commit unless explicit speaker approval is supplied.

## Core invariant

A conforming client must not treat a raw draft as public speech:

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

The Reflective Agent follows one central rule:

> **Expand without inventing.**

Missing reasons, assumptions or intentions should be surfaced as uncertainty or questions, not silently authored by the model.

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

## v0.3 API

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

Reflection:

- `POST /api/reflect`

## Persistence boundary

Stored in SQLite: accounts, hashed sessions, rooms, memberships and committed statements.

Not stored as room discourse: raw drafts, clarification text, Intent Cards and unapproved reformulations. When an external LLM is enabled, private reflective inputs are processed by that provider.

See [`docs/persistence.md`](docs/persistence.md), [`docs/privacy.md`](docs/privacy.md), and [`docs/multi-user.md`](docs/multi-user.md).

## Development

```bash
npm test
```

Tests cover password hashing, session revocation, account-based membership, explicit approval, and persistence across a database reopen.

## Project structure

```text
public/              reference web client
src/reflector.js     Intent Card normalization and demo reflector
src/openai.js        OpenAI reflection adapter
src/store.js         SQLite accounts, sessions, rooms and messages
server.js            HTTP API, auth cookies and SSE transport
test/                protocol and persistence tests
docs/                philosophy, protocol, privacy and persistence notes
```

## Current limits

v0.3 is a reference implementation rather than a production identity service. It does not yet include email verification, password reset, rate limiting, moderation roles, rich presence, encrypted-at-rest private storage, or horizontal multi-process SSE fan-out.

## License

MIT
