# Persistence and authentication (v0.3)

Intent Commit v0.3 replaces the in-memory room store with SQLite through Node's built-in `node:sqlite` module.

## Persisted records

The server stores:

- user account id, username, display name, password salt/hash, creation time;
- hashed login session tokens and expiry times;
- rooms and room memberships;
- human-approved committed statements and timestamps.

## Deliberately not persisted as room discourse

The communication protocol does not persist these as public room records:

- raw drafts;
- clarification text;
- Intent Cards;
- unapproved reformulations.

When an external AI provider is enabled, drafts and clarifications are transmitted to that provider to perform reflection. That processing boundary is separate from public room persistence.

## Passwords and sessions

Passwords are hashed with Node's `scrypt` implementation using a random per-user salt. Raw passwords are never stored.

Login sessions use random bearer tokens. Only a SHA-256 digest of each token is stored in SQLite. The raw token is sent to the browser as an `HttpOnly`, `SameSite=Lax` cookie so ordinary browser JavaScript cannot read it.

This is an open-source reference implementation, not a claim of production security certification. Internet-facing deployments should additionally use HTTPS, set `COOKIE_SECURE=true`, review CSRF/rate-limiting requirements, configure backups, and establish an operational security policy.
