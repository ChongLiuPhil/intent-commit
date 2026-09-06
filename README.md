# Intent Commit

**Think before you commit.**

Intent Commit is an open-source reflective communication protocol and reference client. AI does not speak on behalf of a human. Instead, it helps the speaker inspect, clarify, and explicitly approve what they are willing to mean before that statement becomes public.

> Draft privately → Reflect → Clarify → Approve → Commit → Share

## v0.2: real multi-user rooms

The reference client now supports multiple people using separate browsers or devices:

- create a room and share its room code / invite link;
- each participant receives an independent private room session;
- each participant has a private reflective workspace;
- only speaker-approved statements are stored in the room conversation;
- committed messages are synchronized live with Server-Sent Events (SSE);
- the public timeline records the human author of each committed statement;
- room histories are isolated from one another.

### Important v0.2 limitation

Rooms, participants, and committed messages are currently stored **in server memory only**. Restarting the Node process clears active rooms. This is intentional for the first multi-user MVP; persistent storage and authentication belong in a later release.

## Why this exists

Ordinary chat software makes sending nearly frictionless:

`raw input → public message`

Intent Commit inserts a reflective layer:

`raw input → AI interpretation → speaker clarification → speaker approval → committed message`

The AI is a **Reflective Agent**, not a ghostwriter. Its core rule is:

> **Expand without inventing.**

If a reason, assumption, intention, or scope is missing, the agent should surface the uncertainty or ask a question rather than silently authoring a stronger position.

## Run locally

Requirements: Node.js 20+

```bash
npm start
```

Open `http://localhost:3000`.

Without an API key, Intent Commit uses a deterministic demo reflector. To use OpenAI:

```bash
cp .env.example .env
```

Then set:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

The Responses API is used for reflection. Private drafts are sent to the configured server-side model provider when AI mode is enabled, but they are not broadcast to room participants.

## Multi-user flow

1. Alice creates a room and sends Bob the invite link.
2. Alice drafts a statement privately.
3. Alice's Reflective Agent produces an Intent Card.
4. Alice corrects or clarifies the interpretation.
5. Alice approves the final statement and selects **Commit & Send**.
6. Only that approved statement enters the room timeline.
7. Bob receives it live, then goes through the same private reflection process before replying.

## API surface in v0.2

- `POST /api/rooms` — create room and creator session
- `POST /api/rooms/:code/join` — join room
- `GET /api/rooms/:code?token=...` — fetch authenticated room snapshot
- `GET /api/rooms/:code/events?token=...` — live SSE snapshots
- `POST /api/rooms/:code/commit` — publish an explicitly approved statement
- `POST /api/rooms/:code/leave` — invalidate a participant session
- `POST /api/reflect` — privately reflect on the current speaker's draft

## Trust boundary

### Public to room participants

- display name
- public participant id
- committed statement
- commit timestamp

### Private to the speaker workflow

- raw draft
- clarification text
- Intent Card
- session token

When an external model provider is enabled, raw drafts and clarifications are necessarily processed by that provider. See [`docs/privacy.md`](docs/privacy.md).

## Protocol states

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

`DRAFT → COMMITTED` is deliberately forbidden by the interaction design and server commit API.

## Project structure

```text
intent-commit/
├── public/              # reference web client
├── src/
│   ├── reflector.js     # deterministic reflector + card normalization
│   ├── openai.js        # OpenAI reflection adapter
│   └── rooms.js         # multi-user room/session domain logic
├── test/                # protocol and room tests
├── docs/
│   ├── philosophy.md
│   ├── protocol.md
│   ├── agent-spec.md
│   ├── privacy.md
│   └── multi-user.md
└── server.js            # HTTP, room APIs and SSE transport
```

## Roadmap

- durable database-backed room history;
- account authentication and revocable sessions;
- encrypted / privacy-preserving storage options;
- WebSocket transport for richer presence and typing-state features;
- room roles and moderation without exposing private drafts;
- independently versioned Intent Commit protocol package;
- adapters for forums, issue trackers, email and team chat;
- user-controlled expression profiles without covert personality simulation.

## Development

```bash
npm test
```

The tests include a hard invariant: the server refuses to commit a statement unless explicit speaker approval is supplied.

## License

MIT
