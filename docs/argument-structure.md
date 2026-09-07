# Author-Approved Argument Structure

Intent Commit v0.9 introduces a fine-grained public structure for an already-federated utterance. The structure is not treated as something the AI can author on the speaker's behalf.

## Two different acts

A committed and federated utterance may be analyzed privately without creating any new public object:

```text
Federated utterance
      ↓
Private AI suggestion
      ↓
Human inspection / editing
      ↓
Explicit argument-map approval
      ↓
Signed public argument map
```

The suggestion response is not stored as room discourse and is not public federation state. Only the final structure explicitly approved by the original author is signed and persisted.

## Node kinds

v0.9 deliberately keeps the vocabulary small:

- `claim` — a proposition or position the speaker is presenting;
- `reason` — content the speaker presents as support;
- `objection` — content the speaker presents as a challenge;
- `qualification` — content that narrows, conditions, or limits another node.

Every public argument map must contain at least one `claim`.

## Internal edge predicates

- `supports`
- `challenges`
- `qualifies`

The validator enforces basic semantic consistency:

```text
reason        --supports--> ...
objection     --challenges-> ...
qualification --qualifies--> ...
```

A `claim` node may participate in any of the three predicates because a claim can itself support, challenge, or qualify another claim.

Edges must reference existing node IDs, cannot point from a node to itself, and duplicate `(source, target, predicate)` edges are rejected.

## Public signed object

The federation type is:

```text
federated-argument-map
```

A map contains:

```json
{
  "subject": "https://intent.example/federation/utterances/message-id",
  "actor": {
    "id": "human-user-id",
    "displayName": "Human name"
  },
  "structure": {
    "nodes": [
      { "id": "claim-1", "kind": "claim", "text": "..." },
      { "id": "reason-1", "kind": "reason", "text": "..." }
    ],
    "edges": [
      { "source": "reason-1", "target": "claim-1", "predicate": "supports" }
    ]
  },
  "proof": {
    "algorithm": "Ed25519",
    "signature": "..."
  }
}
```

Schema:

```text
packages/federation/schemas/argument-map.schema.json
```

## Authorship invariant

Only the original human author of the federated utterance may publish its argument map through the reference server. A room owner, moderator, another participant, or AI agent cannot publish a map for someone else's utterance.

This matters because an argument map can add pragmatic commitments beyond the bare text. Declaring that sentence A is a *reason for* sentence B is itself a public interpretive act.

## Immutability and uniqueness

v0.9 allows at most one public argument map per federated utterance. The signed map is immutable once published.

If the author's substantive position changes, the existing v0.7 revision mechanism should create a new federated utterance, and the new utterance may receive its own argument map. A later protocol version may define signed argument-map correction events if that becomes necessary.

## Private suggestion endpoint

```text
POST /api/rooms/:code/arguments/suggest
```

The caller must be the original author. The utterance must already be federated. With an OpenAI key configured, the server requests a conservative decomposition that is forbidden from inventing missing reasons or claims. In deterministic demo mode the suggestion is only one `claim` node containing the original statement.

## Public approval endpoint

```text
POST /api/rooms/:code/federation/arguments
```

Example:

```json
{
  "messageId": "message-id",
  "nodes": [
    { "id": "claim-1", "kind": "claim", "text": "..." }
  ],
  "edges": [],
  "approved": true
}
```

The server independently validates authorship, federation publication, explicit approval, node/edge semantics, and one-map-per-utterance uniqueness before signing.

## Public discovery

```text
GET /federation/arguments/:mapId
GET /federation/utterances/:messageId/relations
GET /federation/graph
```

The utterance relation endpoint includes its argument map when one exists. The public graph also lists signed argument maps separately from cross-utterance provenance edges.

## Boundary with provenance

Argument structure is **inside one utterance**:

```text
reason-1 --supports--> claim-1
```

Provenance is **between public utterances**:

```text
U1 --supports--> U2
```

The two layers are intentionally distinct. A speaker may publicly structure their own utterance without asserting any relation to another person's utterance, and vice versa.
