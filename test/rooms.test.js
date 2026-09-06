import test from "node:test";
import assert from "node:assert/strict";
import { createRoomStore } from "../src/rooms.js";

function deterministicStore() {
  let id = 0;
  let code = 0;
  return createRoomStore({
    now: () => "2026-09-06T00:00:00.000Z",
    makeId: () => `id-${++id}`,
    makeCode: () => `ROOM${++code}`,
  });
}

test("creator and joiner receive independent private session tokens", () => {
  const store = deterministicStore();
  const a = store.createRoom({ displayName: "Alice", roomName: "Test" });
  const b = store.joinRoom({ code: a.room.code, displayName: "Bob" });

  assert.notEqual(a.session.participantToken, b.session.participantToken);
  assert.equal(b.room.participants.length, 2);
  assert.ok(b.room.participants.every((p) => !("token" in p)));
});

test("a message cannot be committed without explicit speaker approval", () => {
  const store = deterministicStore();
  const a = store.createRoom({ displayName: "Alice" });

  assert.throws(() => store.commitMessage({
    code: a.room.code,
    participantToken: a.session.participantToken,
    statement: "Draft that should not be public",
    approved: false,
  }), /approval/i);

  assert.equal(store.getSnapshot(a.room.code, a.session.participantToken).messages.length, 0);
});

test("committed messages expose the human author, not the private session token", () => {
  const store = deterministicStore();
  const a = store.createRoom({ displayName: "Alice" });
  const message = store.commitMessage({
    code: a.room.code,
    participantToken: a.session.participantToken,
    statement: "This is what I am willing to mean.",
    approved: true,
  });

  assert.equal(message.author.name, "Alice");
  assert.equal(message.statement, "This is what I am willing to mean.");
  assert.ok(!("participantToken" in message));
});

test("rooms isolate their committed histories", () => {
  const store = deterministicStore();
  const a = store.createRoom({ displayName: "Alice" });
  const b = store.createRoom({ displayName: "Bob" });

  store.commitMessage({
    code: a.room.code,
    participantToken: a.session.participantToken,
    statement: "Only room A should see this.",
    approved: true,
  });

  assert.equal(store.getSnapshot(a.room.code, a.session.participantToken).messages.length, 1);
  assert.equal(store.getSnapshot(b.room.code, b.session.participantToken).messages.length, 0);
});

test("leaving a room invalidates that participant session", () => {
  const store = deterministicStore();
  const a = store.createRoom({ displayName: "Alice" });
  store.leaveRoom({ code: a.room.code, participantToken: a.session.participantToken });

  assert.throws(() => store.getSnapshot(a.room.code, a.session.participantToken), /invalid room session/i);
});
