# Intent Commit

[简体中文 README](README.zh-CN.md)

**Think before you commit.**

Intent Commit is an open-source experiment in **reflective, AI-assisted human communication**. Instead of allowing a rough draft to become a public message immediately, it inserts a private metacognitive step:

```text
Draft → AI reflection → Speaker clarification → Speaker approval → Committed statement
```

The AI does not speak for the user. It helps the user inspect what they are about to make attributable to themselves.

## Why this is different from an AI writing assistant

Most writing assistants optimize the sentence. Intent Commit optimizes the **speaker's opportunity to inspect and endorse the meaning**.

The core rule is:

> **Expand without inventing.**

If a reason is missing, the agent should ask for it instead of fabricating one. If the speaker is uncertain, the agent should preserve the uncertainty. If the agent is wrong, the speaker corrects it before anything becomes public.

## MVP

The repository contains a dependency-free Node.js reference client with:

- two alternating speakers;
- a private draft area;
- an AI-generated Intent Card;
- a clarification / re-reflection loop;
- an editable final statement;
- explicit **Commit & Send** approval;
- a public timeline containing only committed statements;
- browser-local conversation persistence;
- an OpenAI Responses API adapter;
- a no-key deterministic demo mode for development and testing.

## Run it

Requires Node.js 20+.

```bash
cp .env.example .env
# optionally edit .env and add OPENAI_API_KEY

# export variables from .env using your preferred shell/tool, then:
npm start
```

Open `http://localhost:3000`.

### Quick run without any API key

```bash
npm start
```

The header will show `DEMO REFLECTOR`. This mode is intentionally limited; it demonstrates the interaction protocol without pretending to be a full language model.

### Run with OpenAI

Set:

```bash
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.6-luna
npm start
```

The API key is read only by the Node server and is never sent to browser JavaScript.

## The Intent Card

Before committing, the speaker sees:

- core claim;
- communicative intention;
- explicit reasons;
- possible assumptions;
- ambiguities;
- possible misinterpretations;
- questions for the speaker;
- proposed faithful reformulation.

The card is **private by default**. The listener receives only the final speaker-approved statement.

## Protocol invariant

A conforming client should never allow:

```text
DRAFT → SENT
```

Public speech requires an explicit human approval step:

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → SENT
```

See [`docs/protocol.md`](docs/protocol.md).

## Project documents

- [`docs/philosophy.md`](docs/philosophy.md) — philosophical rationale
- [`docs/protocol.md`](docs/protocol.md) — state protocol
- [`docs/agent-spec.md`](docs/agent-spec.md) — non-invention rules and Intent Card schema
- [`docs/privacy.md`](docs/privacy.md) — MVP privacy boundary
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution direction

## Architecture

```text
Browser
├── Public committed conversation (localStorage)
└── Private reflective workspace
    ├── raw draft
    ├── clarification
    └── Intent Card
          │
          ▼
Node server /api/reflect
├── OpenAI Responses API adapter (when configured)
└── deterministic demo reflector (fallback)
```

No database is required for the MVP.

## What this project is not

Intent Commit is not intended to:

- autonomously negotiate on behalf of users;
- impersonate users;
- infer a hidden "true self";
- silently improve an argument by adding facts or reasons;
- send messages without human approval.

Those constraints are features, not missing capabilities.

## Roadmap

1. **v0.1 — Reflective loop**: current repository.
2. **v0.2 — Real multi-user rooms**: authenticated sessions and a server-side message store.
3. **v0.3 — Protocol package**: transport-neutral TypeScript schemas and interoperability tests.
4. **v0.4 — User-controlled expression profiles**: opt-in preferences without identity impersonation.
5. **v0.5 — Adapters**: issue trackers, forums, email, Matrix/ActivityPub experiments.
6. **Research track**: metrics for meaning drift, speaker endorsement, clarification value, and conflict reduction.

## Research questions

- Does reflection reduce unintended meaning drift?
- Which Intent Card fields most often trigger useful self-correction?
- Does explicit commitment improve perceived fairness in disagreement?
- When does AI clarification help, and when does it over-structure ordinary conversation?
- Can we measure the distance between an initial draft and a reflectively endorsed utterance without treating either as privileged access to a "true" intention?

## License

MIT. See [`LICENSE`](LICENSE).
