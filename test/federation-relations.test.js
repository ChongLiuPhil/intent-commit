import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createFederatedRetraction,
  createFederatedRevision,
  verifyFederationRelation,
  RETRACTION_TYPE,
  REVISION_TYPE,
} from "../packages/federation/index.js";
import { createFederationEventStore } from "../src/federation-events.js";

const issuer = "https://example.org";
const original = `${issuer}/federation/utterances/message-1`;
const replacement = `${issuer}/federation/utterances/message-2`;
const actor = { id: "alice-id", displayName: "Alice" };

test("signed retraction verifies and tampering is detected", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const event = createFederatedRetraction({
    issuer,
    eventId: "event-1",
    actor,
    subject: original,
    reason: "I no longer endorse this statement.",
    publishedAt: "2026-09-06T16:00:00.000Z",
    privateKey,
    publicKey,
  });
  assert.equal(event.type, RETRACTION_TYPE);
  assert.equal(event.subject, original);
  assert.equal(verifyFederationRelation(event, publicKey).ok, true);

  const tampered = structuredClone(event);
  tampered.reason = "Different reason";
  assert.equal(verifyFederationRelation(tampered, publicKey).ok, false);
});

test("signed revision points to a separately federated replacement", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const event = createFederatedRevision({
    issuer,
    eventId: "event-2",
    actor,
    subject: original,
    replacement,
    reason: "This later utterance states my view more accurately.",
    publishedAt: "2026-09-06T16:05:00.000Z",
    privateKey,
    publicKey,
  });
  assert.equal(event.type, REVISION_TYPE);
  assert.equal(event.replacement, replacement);
  assert.equal(verifyFederationRelation(event, publicKey).ok, true);
  assert.throws(() => createFederatedRevision({
    issuer,
    eventId: "event-self",
    actor,
    subject: original,
    replacement: original,
    privateKey,
    publicKey,
  }), /different utterance/i);
});

test("federation event store allows only one direct relation per utterance", () => {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const events = createFederationEventStore(db, { makeId: () => `event-${++n}` });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const firstId = events.nextId();
  const retraction = createFederatedRetraction({
    issuer,
    eventId: firstId,
    actor,
    subject: original,
    publishedAt: "2026-09-06T16:10:00.000Z",
    privateKey,
    publicKey,
  });
  events.record({ id: firstId, roomCode: "ROOM42", authorUserId: actor.id, envelope: retraction });
  assert.equal(events.getBySubject(original).type, RETRACTION_TYPE);

  const secondId = events.nextId();
  const revision = createFederatedRevision({
    issuer,
    eventId: secondId,
    actor,
    subject: original,
    replacement,
    publishedAt: "2026-09-06T16:11:00.000Z",
    privateKey,
    publicKey,
  });
  assert.throws(() => events.record({ id: secondId, roomCode: "ROOM42", authorUserId: actor.id, envelope: revision }), /already has a direct/i);
  db.close();
});
