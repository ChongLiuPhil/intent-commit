import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createFederatedArgumentMap,
  normalizeArgumentMapContent,
  verifyFederatedArgumentMap,
} from "../packages/federation/index.js";
import { createArgumentMapStore } from "../src/argument-maps.js";
import { demoSuggestArgumentStructure } from "../src/argument-suggestions.js";

const issuer = "https://intent.example.org";
const subject = `${issuer}/federation/utterances/message-1`;
const actor = { id: "user-1", displayName: "Alice" };

function keys() {
  return generateKeyPairSync("ed25519");
}

function sampleStructure() {
  return {
    nodes: [
      { id: "claim-1", kind: "claim", text: "Reflective endorsement matters for public commitment." },
      { id: "reason-1", kind: "reason", text: "A draft may not yet express what the speaker is willing to endorse." },
      { id: "objection-1", kind: "objection", text: "Reflection can still introduce interpretation errors." },
      { id: "qualification-1", kind: "qualification", text: "The claim concerns public commitment, not private thought." },
    ],
    edges: [
      { source: "reason-1", target: "claim-1", predicate: "supports" },
      { source: "objection-1", target: "claim-1", predicate: "challenges" },
      { source: "qualification-1", target: "claim-1", predicate: "qualifies" },
    ],
  };
}

test("normalizes a valid fine-grained argument structure", () => {
  const structure = normalizeArgumentMapContent(sampleStructure());
  assert.equal(structure.nodes.length, 4);
  assert.equal(structure.edges.length, 3);
  assert.equal(structure.nodes[0].kind, "claim");
});

test("rejects invented structural semantics such as a reason challenging a claim", () => {
  assert.throws(() => normalizeArgumentMapContent({
    nodes: [
      { id: "claim-1", kind: "claim", text: "Claim" },
      { id: "reason-1", kind: "reason", text: "Reason" },
    ],
    edges: [{ source: "reason-1", target: "claim-1", predicate: "challenges" }],
  }), /Reason nodes may only create supports edges/);
});

test("signs and verifies an argument map and detects tampering", () => {
  const { privateKey, publicKey } = keys();
  const structure = sampleStructure();
  const envelope = createFederatedArgumentMap({
    issuer,
    mapId: "map-1",
    actor,
    subject,
    ...structure,
    privateKey,
    publicKey,
  });
  assert.equal(verifyFederatedArgumentMap(envelope, publicKey).ok, true);
  const tampered = structuredClone(envelope);
  tampered.structure.nodes[0].text = "A different public claim.";
  assert.equal(verifyFederatedArgumentMap(tampered, publicKey).ok, false);
});

test("stores at most one public argument map per federated utterance", () => {
  const db = new DatabaseSync(":memory:");
  const store = createArgumentMapStore(db, { makeId: () => "map-1" });
  const { privateKey, publicKey } = keys();
  const envelope = createFederatedArgumentMap({ issuer, mapId: "map-1", actor, subject, ...sampleStructure(), privateKey, publicKey });
  store.record({ id: "map-1", messageId: "message-1", roomCode: "ABC123", authorUserId: "user-1", envelope });
  assert.equal(store.getByMessageId("message-1").mapUri, `${issuer}/federation/arguments/map-1`);
  assert.throws(() => store.record({ id: "map-2", messageId: "message-1", roomCode: "ABC123", authorUserId: "user-1", envelope: { ...envelope, id: `${issuer}/federation/arguments/map-2` } }), /already has an argument map/);
  db.close();
});

test("demo suggestion makes no hidden argumentative inference", () => {
  const statement = "I think this proposal may need another review.";
  const structure = demoSuggestArgumentStructure(statement);
  assert.deepEqual(structure, {
    nodes: [{ id: "claim-1", kind: "claim", text: statement }],
    edges: [],
  });
});
