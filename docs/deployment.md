# Deployment

Intent Commit v0.4 can run directly with Node.js 22.13+ or as a Docker container.

## Local Node

```bash
cp .env.example .env
npm start
```

The default SQLite database is `data/intent-commit.sqlite`.

## Docker Compose

```bash
docker compose up --build
```

The Compose configuration stores SQLite data in the named volume `intent_commit_data` and publishes the app on port `3000`.

For local HTTP development, Compose sets:

```text
COOKIE_SECURE=false
```

## Production HTTPS

Production deployments should terminate TLS and set:

```text
COOKIE_SECURE=true
```

The supplied `Dockerfile` already defaults to `COOKIE_SECURE=true`.

Persist `/app/data` across container replacement. The SQLite database, WAL, and related files live there.

## Environment variables

- `PORT` — HTTP port, default `3000`
- `DATABASE_PATH` — SQLite path, default `data/intent-commit.sqlite` outside Docker
- `SESSION_TTL_DAYS` — login session lifetime, default `30`
- `COOKIE_SECURE` — require HTTPS for the session cookie
- `OPENAI_API_KEY` — optional server-side model key
- `OPENAI_MODEL` — optional reflection model name

## Reverse proxy requirements

SSE is used for live room snapshots. A reverse proxy should:

- keep long-lived HTTP responses open;
- avoid buffering `text/event-stream` responses;
- use reasonable idle timeouts longer than the server keepalive interval.

The application sends `X-Accel-Buffering: no` for compatible proxies.

## Data boundary

Persisted data includes accounts, password hashes, login-session token hashes, room membership, roles, and committed messages.

Raw drafts, clarification text, Intent Cards, and unapproved proposed statements are not intentionally written to SQLite by the reference server. When an external model provider is enabled, private reflection inputs are processed by that provider.

## Current production limitations

v0.4 is deployable but not yet a hardened large-scale service. Before exposing it to untrusted public traffic, consider adding:

- rate limiting;
- email/account recovery;
- CSRF protection beyond SameSite cookies;
- audit logging for moderation actions;
- backup/restore procedures;
- database migration tooling;
- abuse reporting and room-level policy controls;
- observability and alerting.
