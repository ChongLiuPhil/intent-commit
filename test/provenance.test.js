import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createFederatedProvenanceEdge,
  verifyFederatedProvenanceEdge,
} from "../packages/federation/index.js";
import { createProvenanceEdgeStore } from "../src/provenance-edges.js";

const issuer = "https://example.org";
const source = `${issuer}/federation/utterances/source-1`;
const target = `${issuer}/federation/utterances/target-1`;

test("signed provenance edge verifies and tampering fails", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const edge = createFederatedProvenanceEdge({
    issuer,
    edgeId: "edge-1",
    actor: { id: "alice-id", displayName: "Alice" },
    source,
    target,
    predicate: "supports",
    note: "This public claim provides a reason for the target.",
    publishedAt: "2026-09-08T00:00:00.000Z",
    privateKey,
    publicKey,
  });

  assert.equal(edge.type, "federated-provenance-edge");
  assert.equal(edge.predicate, "supports");
  assert.equal(verifyFederatedProvenanceEdge(edge, publicKey).ok, true);

  const tampered = structuredClone(edge);
  tampered.predicate = "challenges";
  assert.equal(verifyFederatedProvenanceEdge(tampered, publicKey).ok, false);
});

test("provenance edge rejects self-links and unknown predicates", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const base = {
    issuer,
    edgeId: "edge-2",
    actor: { id: "alice-id", displayName: "Alice" },
    source,
    target,
    publishedAt: "2026-09-08T00:00:00.000Z",
    privateKey,
    publicKey,
  };

  assert.throws(() => createFederatedProvenanceEdge({ ...base, target: source, predicate: "cites" }), /different utterance/i);
  assert.throws(() => createFederatedProvenanceEdge({ ...base, predicate: "agrees-with" }), /predicate must be one of/i);
});

test("provenance store indexes graph direction and rejects duplicate semantic edges", () => {
  const db = new DatabaseSync(":memory:");
  const edges = createProvenanceEdgeStore(db, { makeId: () => "edge-db-1" });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const envelope = createFederatedProvenanceEdge({
    issuer,
    edgeId: "edge-db-1",
    actor: { id: "alice-id", displayName: "Alice" },
    source,
    target,
    predicate: "cites",
    publishedAt: "2026-09-08T00:00:00.000Z",
    privateKey,
    publicKey,
  });

  edges.record({ id: "edge-db-1", roomCode: "ROOM42", authorUserId: "alice-id", envelope });
  assert.equal(edges.listOutgoing(source).length, 1);
  assert.equal(edges.listIncoming(target).length, 1);
  assert.equal(edges.listAll().length, 1);
  assert.throws(
    () => edges.record({ id: "edge-db-2", roomCode: "ROOM42", authorUserId: "alice-id", envelope: { ...envelope, id: `${issuer}/federation/provenance/edge-db-2` } }),
    /already exists/i,
  );
  db.close();
});
