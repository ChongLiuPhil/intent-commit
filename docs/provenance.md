# Intent Commit Provenance Graph v1.2

v0.8 adds signed relationships between already-public federated utterances. These relationships are not inferred by AI and are not moderation labels. They are new public assertions made by the original author of the source utterance.

## Predicates

The first graph vocabulary is intentionally small:

```text
cites
supports
challenges
```

`cites` means the source explicitly points to the target without asserting support or opposition.

`supports` means the source author publicly asserts that the source provides support for the target.

`challenges` means the source author publicly asserts that the source raises a challenge to the target.

These predicates describe an authored argumentative relation. They do not claim that the relation is objectively correct.

## Authority rule

For an edge:

```text
U_source --predicate--> U_target
```

only the original human author of `U_source` may create the edge.

A room owner, moderator, AI agent, target author, or server administrator cannot use the protocol API to attribute the edge to the source author.

The source and target must both already have federation publication records. Creating an edge therefore never silently federates a private or room-only statement.

## Signed envelope

A provenance edge is a standalone signed federation object:

```json
{
  "protocol": "intent-commit",
  "federationVersion": "1.2",
  "type": "federated-provenance-edge",
  "actor": { "id": "...", "displayName": "..." },
  "source": "https://example.org/federation/utterances/source-id",
  "target": "https://example.org/federation/utterances/target-id",
  "predicate": "supports",
  "note": "Optional public explanation",
  "proof": { "algorithm": "Ed25519", "signature": "..." }
}
```

Schema:

```text
packages/federation/schemas/provenance-edge.schema.json
```

## Public discovery

Whole public graph:

```text
GET /federation/graph
```

One signed edge:

```text
GET /federation/provenance/:edgeId
```

Lifecycle and graph relations around one utterance:

```text
GET /federation/utterances/:messageId/relations
```

The response distinguishes lifecycle relations (`retraction`, `revision`) from provenance edges (`cites`, `supports`, `challenges`).

## Authoring API

Authenticated source authors create an edge with:

```text
POST /api/rooms/:code/federation/provenance
```

Example:

```json
{
  "sourceMessageId": "source-message-id",
  "targetMessageId": "target-message-id",
  "predicate": "challenges",
  "note": "The source disputes the assumption used in the target.",
  "approved": true
}
```

The server re-checks that the authenticated user is the original author of the source message and that both endpoints are already federated.

## Graph invariants

- source and target must be different utterances;
- predicate must be `cites`, `supports`, or `challenges`;
- one identical `(source, target, predicate)` edge may be published only once;
- edge notes are public and limited to 1000 characters;
- the edge is immutable after signing;
- lifecycle changes do not erase graph history;
- a retracted utterance can remain the target of historical citations or challenges.

## Current scope

v0.8 only creates edges between utterances already federated by the same Intent Commit instance. The server does not fetch arbitrary remote URLs. Cross-instance graph edges require a later trust and remote-verification design.
