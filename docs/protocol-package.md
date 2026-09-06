# Intent Commit Protocol Package

`packages/protocol` is the transport-neutral core of Intent Commit. It is deliberately independent of the reference web client, SQLite, SSE, and any particular LLM provider.

## Protocol version

Current protocol version: `1.0`.

The package exports:

- `MESSAGE_STATES`
- `ROOM_ROLES`
- `canTransition(from, to)`
- `assertTransition(from, to)`
- `normalizeIntentCard(card)`
- `validateIntentCard(card)`
- `createCommittedMessage(input)`
- `validateCommittedMessage(message)`
- `canManageMember(actorRole, targetRole)`

## State invariant

A public message may only result from the approval path:

```text
DRAFT
  ↓
REFLECTED
  ↕
CLARIFYING
  ↓
APPROVED
  ↓
COMMITTED
```

In particular, the protocol rejects:

```text
DRAFT → COMMITTED
```

This invariant is tested in `test/protocol.test.js`.

## Intent Card

The Intent Card is a private reflective artifact. Its schema is published as:

`packages/protocol/schemas/intent-card.schema.json`

The schema describes the structure exchanged between a reflective agent and a speaker-facing client. It does **not** make the card public room data.

## Committed Message envelope

Adapters should exchange public utterances using the `committed-message` envelope defined by:

`packages/protocol/schemas/committed-message.schema.json`

Example:

```json
{
  "protocol": "intent-commit",
  "protocolVersion": "1.0",
  "type": "committed-message",
  "state": "COMMITTED",
  "id": "message-id",
  "room": { "code": "ROOM42" },
  "author": {
    "id": "human-user-id",
    "displayName": "Alice"
  },
  "statement": "This is what I am willing to mean.",
  "committedAt": "2026-09-06T06:00:00.000Z"
}
```

The author is explicitly a human participant. An adapter must not relabel AI-generated text as a human committed message unless the human approval step occurred.

## Reference server endpoint

The bundled server exposes protocol-formatted history at:

```text
GET /api/rooms/:code/protocol/messages
```

The requesting user must be an authenticated member of the room.

## Adapter rule

An adapter may change transport, storage, UI, or model provider. It must not silently weaken these protocol properties:

1. private reflection remains distinct from public discourse;
2. public messages are attributable to a human author;
3. approval is explicit;
4. missing speaker content is not invented by the reflective agent;
5. draft-to-commit shortcuts are forbidden.
