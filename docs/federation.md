# Intent Commit Federation v1.1

v0.7 extends verifiable outbound federation with **signed retraction and revision relations**. It still does not implement a remote inbox, automatic delivery, following, or ActivityPub compatibility.

The central rule is that public history is not silently rewritten. A federated utterance remains an immutable signed artifact. If the author later changes their position, the change is represented by a new signed event.

## Consent boundary

Room commitment, federation publication, and later public correction are distinct acts:

```text
Room COMMITTED
      ↓
Explicit federation approval by the original author
      ↓
Signed public utterance
      ↓
Optional later author action
      ├── signed retraction
      └── signed revision → separately federated replacement
```

Owners and moderators cannot publish, retract, or revise another participant's federated utterance.

## Instance identity

When federation is enabled, the server maintains a persistent Ed25519 key pair. By default:

```text
data/federation-private.pem
data/federation-public.pem
```

The private key is never exposed through HTTP. The public key and supported federation versions are discoverable at:

```text
GET /.well-known/intent-commit
```

Federation v1.1 continues to verify v1.0 utterances already published by earlier Intent Commit versions.

## Publishing an utterance

Federation remains opt-in:

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

The original author publishes a committed message with:

```text
POST /api/rooms/:code/federation/publish
```

The canonical URI is:

```text
https://intent.example.org/federation/utterances/<messageId>
```

Only messages explicitly published this way are public federation objects.

## Retraction

A retraction says that the author no longer endorses a previously federated utterance. It does **not** delete or mutate the original signed object.

```text
POST /api/rooms/:code/federation/retract
```

Body:

```json
{
  "messageId": "old-message-id",
  "approved": true,
  "reason": "Optional public reason"
}
```

The result is a new signed `federated-retraction` event whose `subject` is the original canonical utterance URI.

## Revision

A revision says that a later federated utterance should replace an earlier one as the author's current formulation.

The replacement must first travel through the full Intent Commit path independently:

```text
private draft → reflect → approve → COMMIT → federation approval
```

Only then can the author link the old public utterance to the new one:

```text
POST /api/rooms/:code/federation/revise
```

Body:

```json
{
  "messageId": "old-message-id",
  "replacementMessageId": "new-message-id",
  "approved": true,
  "reason": "Optional public reason"
}
```

The result is a signed `federated-revision` event containing both `subject` and `replacement` canonical URIs.

## Relation invariants

v1.1 intentionally keeps relation semantics narrow:

- one federated utterance may have at most one direct retraction-or-revision event;
- a revision cannot point to itself;
- the original and replacement must be federated by the same instance;
- both must belong to the authenticated original author in the room API;
- the replacement must already have been independently federated;
- a revision cannot point to an utterance that has already been retracted;
- revision chains cannot form cycles.

This permits linear chains such as:

```text
U1 → U2 → U3
```

while rejecting ambiguous or cyclic histories such as:

```text
U1 → U2 → U1
```

## Public discovery

Instance descriptor:

```text
GET /.well-known/intent-commit
```

Signed utterance:

```text
GET /federation/utterances/:messageId
```

Relations for an utterance:

```text
GET /federation/utterances/:messageId/relations
```

Signed relation event:

```text
GET /federation/events/:eventId
```

The utterance envelope itself never changes when a relation is added. External systems discover later status through the relation endpoint and verify the relation event separately.

## Signed objects

Schemas:

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
```

Reusable signing and verification code:

```text
packages/federation/index.js
```

Both utterances and relation events use the persistent instance Ed25519 identity. Tampering with any signed field invalidates verification.

## Persistence

Federated utterances are stored in `federation_publications`. Signed retraction/revision events are stored independently in `federation_events`.

Deleting a room cannot erase copies already fetched by remote systems. A retraction therefore means:

> the author publicly records that they no longer endorse the earlier utterance.

It does not mean:

> the earlier utterance never existed.

## Security scope

v0.7 still does not fetch arbitrary remote federation URLs and does not accept inbound federation payloads. This continues to avoid SSRF, remote spam, replay handling, remote identity binding, inbound moderation, and delivery retry semantics until the trust and delivery model is specified.

Production federation should use HTTPS and a stable `PUBLIC_BASE_URL`. Back up the private key securely: losing it means the instance cannot continue signing as the same federation identity.
