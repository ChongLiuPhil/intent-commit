# Multi-user model

## Identity

v0.3 associates public statements with persistent user accounts rather than temporary browser identities.

A user can be a member of multiple rooms. Membership survives process restarts because it is stored in SQLite.

## Room flow

1. An authenticated user creates a room or joins an existing room code.
2. The user drafts privately.
3. The reflective agent returns an Intent Card.
4. The user may clarify and re-reflect.
5. The user explicitly approves the final statement.
6. The server verifies room membership and `approved === true`.
7. Only then is the committed statement inserted into SQLite and broadcast to room members.

## Realtime transport

The reference client uses Server-Sent Events (SSE) for room snapshots. SSE carries only public room state. Private drafts are not sent through the room event stream.

## Presence

The v0.3 member list means **room membership**, not guaranteed online presence. Rich presence is intentionally deferred.
