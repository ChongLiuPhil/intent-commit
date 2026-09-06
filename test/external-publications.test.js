import test from "node:test";
import assert from "node:assert/strict";
import { createPersistentStore } from "../src/store.js";
import { createExternalPublicationStore } from "../src/external-publications.js";

test("external publication audit is persistent and prevents duplicate target publication", () => {
  let n = 0;
  const store = createPersistentStore({
    dbPath: ":memory:",
    makeId: () => `id-${++n}`,
    makeCode: () => "ROOM42",
  });
  const publications = createExternalPublicationStore(store._db, {
    now: () => "2026-09-06T09:00:00.000Z",
    makeId: () => "export-1",
  });
  const alice = store.register({ username: "alice", displayName: "Alice", password: "password-one" });
  const room = store.createRoom({ userId: alice.user.id, roomName: "Bridge room" });
  const message = store.commitMessage({ code: room.code, userId: alice.user.id, statement: "Approved", approved: true });
  publications.record({
    roomCode: room.code,
    messageId: message.id,
    authorUserId: alice.user.id,
    adapter: "github-issues",
    target: "ChongLiuPhil/intent-commit#1",
    externalId: "99",
    externalUrl: "https://github.com/ChongLiuPhil/intent-commit/issues/1#issuecomment-99",
  });
  assert.equal(publications.list(room.code).length, 1);
  assert.throws(() => publications.record({
    roomCode: room.code,
    messageId: message.id,
    authorUserId: alice.user.id,
    adapter: "github-issues",
    target: "ChongLiuPhil/intent-commit#1",
    externalUrl: "duplicate",
  }), /already been published/i);
  store.close();
});
