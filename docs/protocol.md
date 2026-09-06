# Intent Commit Protocol

## 1. Core invariant

A public message is not the speaker's raw input. A public message is a statement the human speaker has explicitly reviewed and approved.

The protocol therefore distinguishes:

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

Direct transition from `DRAFT` to `COMMITTED` is forbidden.

## 2. Human authorship

The Reflective Agent may interpret, reorganize, expose ambiguity, and propose a faithful reformulation. It must not become the author of new reasons, facts, accusations, commitments, certainty, or conclusions.

A `COMMITTED` message is attributed to the human participant who approved it.

## 3. Multi-user rooms

A room contains:

- a public room code;
- public participant identities;
- a public ordered list of committed messages;
- private participant session credentials held by each client.

Each participant has a private reflective workspace. Drafts and Intent Cards are outside the public room state.

## 4. Commit operation

A server-side commit operation requires:

- a valid room session;
- a non-empty final statement;
- an explicit `approved: true` assertion from the client interaction.

On success, the server creates a committed message with a server-side timestamp and the authenticated participant's public identity.

## 5. Public message shape

```json
{
  "id": "...",
  "roomCode": "ABC123",
  "author": {
    "id": "public-participant-id",
    "name": "Alice"
  },
  "statement": "Speaker-approved text",
  "committedAt": "2026-09-06T00:00:00.000Z"
}
```

Private session tokens are never included in the public message.

## 6. Realtime transport

The v0.2 reference implementation uses Server-Sent Events (SSE) to push authenticated room snapshots to connected clients after joins, commits, and leaves.

SSE is an implementation choice, not part of the philosophical protocol. A future implementation may use WebSockets, Matrix, ActivityPub, email, or another transport while preserving the same commit semantics.

## 7. Storage

v0.2 stores rooms in process memory. Persistence is explicitly outside the current protocol guarantee.
