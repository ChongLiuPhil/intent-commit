# Multi-user architecture (v0.2)

## Room state

The Node server owns an in-memory room store. Each room contains public participants and committed messages. Private drafts never enter this store.

## Participant session

Creating or joining a room returns two identifiers:

- `participantId`: public identity used for message attribution;
- `participantToken`: private bearer credential used to authenticate room operations.

The token is never included in room snapshots or committed messages.

## Realtime synchronization

Clients open an authenticated SSE stream:

```text
GET /api/rooms/:code/events?token=...
```

The server sends `snapshot` events. After a join, commit, or leave operation it broadcasts a fresh room snapshot to connected participants.

## Private reflection

A client sends its raw draft to `POST /api/reflect`. The server authenticates the room session, loads recent committed history as public context, and invokes either the deterministic reflector or the configured OpenAI adapter.

The result is returned only to that requesting client.

## Commit boundary

The final public transition is a separate operation:

```text
POST /api/rooms/:code/commit
```

The operation requires `approved: true`. This makes the distinction between "AI suggested this wording" and "the human has committed to this wording" explicit at the API boundary.

## Current limitations

- no database persistence;
- no account login;
- no room-owner/moderator roles;
- no cryptographic end-to-end privacy;
- participant presence is membership-based rather than true online/offline presence;
- SSE rather than bidirectional WebSocket transport.
