# Intent Commit Protocol — Draft v0.1

Intent Commit defines a minimal lifecycle for a human-authored, AI-assisted utterance.

## 1. Core distinction

A **draft** is not a public utterance. A **committed statement** is.

The protocol separates private reflection from public discourse:

```text
DRAFT -> REFLECTED -> CLARIFYING -> APPROVED -> SENT
```

A system MAY cycle between `REFLECTED` and `CLARIFYING` any number of times.

## 2. State definitions

### DRAFT
Private, provisional language entered by the speaker.

### REFLECTED
An agent has produced a structured interpretation of the draft. This interpretation is a hypothesis, not the speaker's position.

### CLARIFYING
The speaker corrects, rejects, narrows, expands, or qualifies the agent's interpretation.

### APPROVED
The speaker explicitly endorses a final statement as representing what they are willing to mean in this conversational context.

### SENT
The approved statement enters the shared discourse space.

## 3. Message envelope

A minimal public message can be represented as:

```json
{
  "id": "uuid",
  "speaker": "speaker-id",
  "statement": "speaker-approved text",
  "committedAt": "ISO-8601 timestamp",
  "agentAssisted": true
}
```

Raw drafts, agent interpretations, and private clarifications MUST NOT be made public by default.

## 4. Commitment invariant

A conforming implementation MUST NOT transition from `DRAFT`, `REFLECTED`, or `CLARIFYING` directly to `SENT`.

A public send requires an explicit human approval event.

## 5. Agent epistemic status

Agent output MUST be presented as an interpretation to be inspected, not as a discovery of a hidden, authoritative intention.

The protocol therefore treats intention as potentially *formed and refined through reflection*, not merely retrieved from a pre-existing mental object.

## 6. Interoperability direction

Future versions may define portable envelopes for:

- agent interpretation cards;
- revision histories;
- user-controlled expression profiles;
- cryptographic commitment signatures;
- transport adapters for Matrix, email, forums, issue trackers, and chat systems.
