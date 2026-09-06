import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTransition,
  canManageMember,
  canTransition,
  createCommittedMessage,
  validateCommittedMessage,
  validateIntentCard,
} from "../packages/protocol/index.js";

test("protocol forbids draft-to-committed shortcut", () => {
  assert.equal(canTransition("DRAFT", "COMMITTED"), false);
  assert.throws(() => assertTransition("DRAFT", "COMMITTED"), /not allowed/i);
  assert.equal(canTransition("APPROVED", "COMMITTED"), true);
});

test("Intent Card validation requires speaker-facing core fields", () => {
  const invalid = validateIntentCard({ core_claim: "A claim" });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((e) => e.includes("communicative_intention")));

  const valid = validateIntentCard({
    core_claim: "A claim",
    communicative_intention: "Ask for clarification",
    proposed_statement: "I want clarification.",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.explicit_reasons, []);
});

test("committed-message envelope is interoperable and human-attributed", () => {
  const message = createCommittedMessage({
    id: "m1",
    roomCode: "abc123",
    author: { id: "u1", displayName: "Alice" },
    statement: "This is what I am willing to mean.",
    committedAt: "2026-09-06T06:00:00.000Z",
  });
  assert.equal(message.protocol, "intent-commit");
  assert.equal(message.protocolVersion, "1.0");
  assert.equal(message.state, "COMMITTED");
  assert.equal(message.room.code, "ABC123");
  assert.equal(validateCommittedMessage(message).ok, true);
});

test("room role capability rule is intentionally narrow", () => {
  assert.equal(canManageMember("owner", "moderator"), true);
  assert.equal(canManageMember("owner", "owner"), false);
  assert.equal(canManageMember("moderator", "member"), true);
  assert.equal(canManageMember("moderator", "moderator"), false);
  assert.equal(canManageMember("member", "member"), false);
});
