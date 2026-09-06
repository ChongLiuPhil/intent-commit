import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPersistentStore } from "../src/store.js";

function memoryStore() {
  let n = 0;
  return createPersistentStore({
    dbPath: ":memory:",
    now: () => "2026-09-06T04:00:00.000Z",
    makeId: () => `id-${++n}`,
    makeCode: () => "ROOM42",
  });
}

test("register hashes passwords and authenticates a persistent session", () => {
  const store = memoryStore();
  const result = store.register({ username: "alice", displayName: "Alice", password: "correct-horse" });
  assert.equal(result.user.username, "alice");
  const row = store._db.prepare("SELECT password_hash FROM users WHERE username = ?").get("alice");
  assert.ok(row.password_hash);
  assert.notEqual(row.password_hash, "correct-horse");
  const auth = store.authenticate(result.session.token);
  assert.equal(auth.user.displayName, "Alice");
  store.close();
});

test("duplicate usernames are rejected case-insensitively", () => {
  const store = memoryStore();
  store.register({ username: "Alice", displayName: "Alice", password: "password-one" });
  assert.throws(() => store.register({ username: "alice", displayName: "Other", password: "password-two" }), /already registered/i);
  store.close();
});

test("room membership is account-based and committed messages require approval", () => {
  let codeN = 0;
  const store = createPersistentStore({ dbPath: ":memory:", makeCode: () => `R00M${++codeN}A` });
  const alice = store.register({ username: "alice", displayName: "Alice", password: "password-one" });
  const bob = store.register({ username: "bob", displayName: "Bob", password: "password-two" });
  const room = store.createRoom({ userId: alice.user.id, roomName: "Test room" });
  store.joinRoom({ code: room.code, userId: bob.user.id });
  assert.throws(() => store.commitMessage({ code: room.code, userId: alice.user.id, statement: "raw draft", approved: false }), /approval/i);
  store.commitMessage({ code: room.code, userId: alice.user.id, statement: "Approved statement", approved: true });
  const snapshot = store.roomSnapshot(room.code, bob.user.id);
  assert.equal(snapshot.participants.length, 2);
  assert.equal(snapshot.messages.length, 1);
  assert.equal(snapshot.messages[0].author.displayName, "Alice");
  assert.equal(snapshot.messages[0].statement, "Approved statement");
  store.close();
});

test("logout revokes the session", () => {
  const store = memoryStore();
  const result = store.register({ username: "alice", displayName: "Alice", password: "password-one" });
  store.logout(result.session.token);
  assert.throws(() => store.authenticate(result.session.token), /Authentication required/i);
  store.close();
});

test("rooms and committed history survive a database reopen", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "intent-commit-"));
  const dbPath = path.join(dir, "intent.sqlite");
  try {
    const first = createPersistentStore({ dbPath, makeCode: () => "PERSIST" });
    const alice = first.register({ username: "alice", displayName: "Alice", password: "password-one" });
    const room = first.createRoom({ userId: alice.user.id, roomName: "Durable room" });
    first.commitMessage({ code: room.code, userId: alice.user.id, statement: "This survives restart.", approved: true });
    const token = alice.session.token;
    first.close();

    const second = createPersistentStore({ dbPath });
    const auth = second.authenticate(token);
    const restored = second.roomSnapshot("PERSIST", auth.user.id);
    assert.equal(restored.name, "Durable room");
    assert.equal(restored.messages[0].statement, "This survives restart.");
    assert.equal(second.listRoomsForUser(auth.user.id).length, 1);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
