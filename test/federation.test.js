import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createCommittedMessage } from "../packages/protocol/index.js";
import { createFederatedUtterance, createInstanceDescriptor, verifyFederatedUtterance } from "../packages/federation/index.js";
import { createFederationPublicationStore } from "../src/federation-publications.js";

test("federated utterances verify and tampering fails", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const message = createCommittedMessage({
    id: "message-1",
    roomCode: "ROOM42",
    author: { id: "alice-id", displayName: "Alice" },
    statement: "This is the statement I committed to.",
    committedAt: "2026-09-06T09:00:00.000Z",
  });
  const envelope = createFederatedUtterance({
    issuer: "https://example.org",
    message,
    publishedAt: "2026-09-06T09:05:00.000Z",
    privateKey,
    publicKey,
  });
  assert.equal(envelope.id, "https://example.org/federation/utterances/message-1");
  assert.equal(verifyFederatedUtterance(envelope, publicKey).ok, true);

  const tampered = structuredClone(envelope);
  tampered.message.statement = "Changed after signing";
  assert.equal(verifyFederatedUtterance(tampered, publicKey).ok, false);
});

test("instance descriptor exposes only the public verification key", () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const descriptor = createInstanceDescriptor({ issuer: "https://example.org/", publicKey, protocolVersion: "1.0" });
  assert.equal(descriptor.issuer, "https://example.org");
  assert.equal(descriptor.publicKey.type, "Ed25519");
  assert.match(descriptor.publicKey.pem, /BEGIN PUBLIC KEY/);
  assert.ok(!JSON.stringify(descriptor).includes("PRIVATE KEY"));
});

test("federation publication store prevents duplicate canonical publication", () => {
  const db = new DatabaseSync(":memory:");
  const publications = createFederationPublicationStore(db, { makeId: () => "pub-1" });
  const envelope = { publishedAt: "2026-09-06T09:05:00.000Z", id: "https://example.org/federation/utterances/message-1" };
  publications.record({
    messageId: "message-1",
    roomCode: "ROOM42",
    authorUserId: "alice-id",
    canonicalUri: envelope.id,
    envelope,
  });
  assert.equal(publications.getByMessageId("message-1").canonicalUri, envelope.id);
  assert.throws(() => publications.record({
    messageId: "message-1",
    roomCode: "ROOM42",
    authorUserId: "alice-id",
    canonicalUri: envelope.id,
    envelope,
  }), /already been published/i);
  db.close();
});
