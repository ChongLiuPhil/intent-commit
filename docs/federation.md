# Intent Commit Federation v1.0

v0.6 introduces **verifiable outbound federation**. It does not yet implement a remote inbox, automatic delivery, following, or ActivityPub compatibility.

The purpose of this phase is narrower: allow a speaker to make one already-COMMITTED utterance publicly addressable and cryptographically verifiable without silently widening the audience of every room message.

## Consent boundary

Room commitment and federation publication are separate acts:

```text
Room COMMITTED
      ↓
Explicit federation approval by the original author
      ↓
Signed public federation envelope
```

A room owner or moderator cannot federate another participant's statement.

## Instance identity

When federation is enabled, the server maintains a persistent Ed25519 key pair. By default the files live in the data directory:

```text
data/federation-private.pem
data/federation-public.pem
```

The private key is never returned by an HTTP endpoint. The public key is discoverable at:

```text
GET /.well-known/intent-commit
```

The instance identity must remain stable across restarts. Docker Compose therefore stores the key files in the same persistent volume as SQLite.

## Publishing

Federation is disabled by default. Configure:

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

For a room member, federation state can be inspected with:

```text
GET /api/rooms/:code/federation
```

The original author can publish one of their own committed messages with:

```text
POST /api/rooms/:code/federation/publish
```

Body:

```json
{
  "messageId": "committed-message-id",
  "approved": true
}
```

The resulting canonical public URI has the form:

```text
https://intent.example.org/federation/utterances/<messageId>
```

Only messages explicitly published this way are available through the public federation endpoint.

## Signed envelope

The signed object contains:

- Intent Commit protocol and federation versions;
- canonical URI;
- issuer instance;
- federation publication timestamp;
- the original protocol-valid COMMITTED message envelope;
- an Ed25519 proof with the instance key identifier and base64url signature.

The signature is calculated over a deterministic JSON serialization of the envelope before the `signature` field is added.

Schema:

```text
packages/federation/schemas/federated-utterance.schema.json
```

Reusable signing and verification code:

```text
packages/federation/index.js
```

## Deletion and retraction

Federation publication is intentionally treated as public publication, not as room storage. A signed federation envelope is persisted independently from the room so its canonical URI remains verifiable even if the local room is later deleted.

This does **not** mean remote copies can be erased. Once another system has fetched a signed public utterance, deleting local data cannot guarantee deletion of those copies.

A future federation version may add explicit retraction statements, but a retraction would be a new signed statement about the previous publication rather than a claim that the previous publication never existed.

## Security scope

v0.6 deliberately does not fetch arbitrary remote federation URLs and does not accept inbound federation payloads. This avoids introducing SSRF, remote spam, replay handling, remote identity binding, moderation of inbound content, and delivery retry semantics before the trust model is defined.

Production federation should use HTTPS and a stable `PUBLIC_BASE_URL`. Back up the private key securely: losing it means the instance cannot continue signing as the same federation identity.
