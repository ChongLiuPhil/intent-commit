# Privacy boundary

Intent Commit separates two kinds of information.

## Public within a room

- account display name and public user id;
- room membership and role;
- committed statement;
- commit timestamp.

These records are persisted in SQLite in v0.3.

## Private reflective material

- raw draft;
- clarification text;
- Intent Card;
- unapproved proposed statement;
- authentication cookie/session token.

The reference client does not store private reflective material in the room database. If an external LLM is configured, raw drafts and clarifications are processed by that provider to produce the reflection, so deployers must disclose and evaluate that provider boundary.

Authentication cookies are marked `HttpOnly` and `SameSite=Lax`. Public deployments should use HTTPS and set `COOKIE_SECURE=true`.
