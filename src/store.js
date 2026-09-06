import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canManageMember, ROOM_ROLES } from "../packages/protocol/index.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function cleanText(value, maxLength, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) {
    throw new Error("Username must be 3-32 characters using letters, numbers, dot, underscore, or hyphen.");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be 8-128 characters.");
  }
  return password;
}

function defaultCode() {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export function createPersistentStore({
  dbPath = "./data/intent-commit.sqlite",
  now = () => new Date().toISOString(),
  makeId = randomUUID,
  makeCode = defaultCode,
  sessionTtlDays = 30,
} = {}) {
  if (dbPath !== ":memory:") mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS room_members (
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (room_code, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      statement TEXT NOT NULL,
      committed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_code, committed_at);
  `);

  const q = {
    userByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    insertUser: db.prepare("INSERT INTO users (id, username, display_name, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    sessionByHash: db.prepare(`SELECT s.*, u.username, u.display_name, u.created_at AS user_created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
    roomByCode: db.prepare("SELECT * FROM rooms WHERE code = ?"),
    insertRoom: db.prepare("INSERT INTO rooms (code, name, created_by, created_at) VALUES (?, ?, ?, ?)"),
    deleteRoom: db.prepare("DELETE FROM rooms WHERE code = ?"),
    insertMember: db.prepare("INSERT OR IGNORE INTO room_members (room_code, user_id, role, joined_at) VALUES (?, ?, ?, ?)"),
    deleteMember: db.prepare("DELETE FROM room_members WHERE room_code = ? AND user_id = ?"),
    updateMemberRole: db.prepare("UPDATE room_members SET role = ? WHERE room_code = ? AND user_id = ?"),
    member: db.prepare("SELECT * FROM room_members WHERE room_code = ? AND user_id = ?"),
    memberCount: db.prepare("SELECT COUNT(*) AS count FROM room_members WHERE room_code = ?"),
    members: db.prepare(`SELECT u.id, u.username, u.display_name, u.created_at, rm.role, rm.joined_at FROM room_members rm JOIN users u ON u.id = rm.user_id WHERE rm.room_code = ? ORDER BY rm.joined_at ASC`),
    messages: db.prepare(`SELECT m.id, m.room_code, m.statement, m.committed_at, u.id AS author_id, u.username AS author_username, u.display_name AS author_display_name FROM messages m JOIN users u ON u.id = m.author_user_id WHERE m.room_code = ? ORDER BY m.committed_at ASC, m.rowid ASC`),
    insertMessage: db.prepare("INSERT INTO messages (id, room_code, author_user_id, statement, committed_at) VALUES (?, ?, ?, ?, ?)"),
    roomsForUser: db.prepare(`SELECT r.code, r.name, r.created_by, r.created_at, rm.role, rm.joined_at FROM room_members rm JOIN rooms r ON r.code = rm.room_code WHERE rm.user_id = ? ORDER BY rm.joined_at DESC`),
  };

  function makeSession(userId) {
    const rawToken = randomBytes(32).toString("base64url");
    const createdAt = now();
    const expiresAt = new Date(Date.parse(createdAt) + sessionTtlDays * 86400_000).toISOString();
    q.insertSession.run(hashToken(rawToken), userId, createdAt, expiresAt);
    return { token: rawToken, expiresAt };
  }

  function register({ username, displayName, password }) {
    const normalized = normalizeUsername(username);
    const name = cleanText(displayName || username, 60, "Display name");
    const pass = validatePassword(password);
    if (q.userByUsername.get(normalized)) throw new Error("Username is already registered.");

    const user = { id: makeId(), username: normalized, displayName: name, createdAt: now() };
    const salt = randomBytes(16).toString("hex");
    q.insertUser.run(user.id, user.username, user.displayName, salt, hashPassword(pass, salt), user.createdAt);
    return { user, session: makeSession(user.id) };
  }

  function login({ username, password }) {
    const normalized = normalizeUsername(username);
    const pass = validatePassword(password);
    const row = q.userByUsername.get(normalized);
    if (!row) throw new Error("Invalid username or password.");
    const actual = Buffer.from(hashPassword(pass, row.password_salt), "hex");
    const expected = Buffer.from(row.password_hash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error("Invalid username or password.");
    }
    return { user: publicUser(row), session: makeSession(row.id) };
  }

  function authenticate(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) throw new Error("Authentication required.");
    const current = now();
    q.deleteExpiredSessions.run(current);
    const row = q.sessionByHash.get(hashToken(token));
    if (!row || row.expires_at <= current) throw new Error("Authentication required.");
    return {
      user: { id: row.user_id, username: row.username, displayName: row.display_name, createdAt: row.user_created_at },
      session: { expiresAt: row.expires_at },
    };
  }

  function logout(rawToken) {
    if (rawToken) q.deleteSession.run(hashToken(rawToken));
  }

  function requireRoom(code) {
    const normalized = String(code || "").trim().toUpperCase();
    const room = q.roomByCode.get(normalized);
    if (!room) throw new Error("Room not found.");
    return room;
  }

  function requireMembership(code, userId) {
    const room = requireRoom(code);
    const membership = q.member.get(room.code, userId);
    if (!membership) throw new Error("You are not a member of this room.");
    return { room, membership };
  }

  function createRoom({ userId, roomName = "" }) {
    let code;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = makeCode().toUpperCase();
      if (!q.roomByCode.get(candidate)) { code = candidate; break; }
    }
    if (!code) throw new Error("Could not allocate a room code.");
    const createdAt = now();
    const name = String(roomName || "").trim().slice(0, 80) || `Room ${code}`;
    q.insertRoom.run(code, name, userId, createdAt);
    q.insertMember.run(code, userId, "owner", createdAt);
    return roomSnapshot(code, userId);
  }

  function joinRoom({ code, userId }) {
    const room = requireRoom(code);
    q.insertMember.run(room.code, userId, "member", now());
    return roomSnapshot(room.code, userId);
  }

  function leaveRoom({ code, userId }) {
    const { room, membership } = requireMembership(code, userId);
    if (membership.role === "owner") {
      const count = Number(q.memberCount.get(room.code).count);
      if (count > 1) throw new Error("Room owner must transfer ownership before leaving.");
      q.deleteRoom.run(room.code);
      return { code: room.code, deleted: true };
    }
    q.deleteMember.run(room.code, userId);
    return { code: room.code, deleted: false };
  }

  function setMemberRole({ code, actorUserId, targetUserId, role }) {
    const { room, membership: actor } = requireMembership(code, actorUserId);
    if (actor.role !== "owner") throw new Error("Only the room owner can change member roles.");
    const normalizedRole = String(role || "").trim().toLowerCase();
    if (!ROOM_ROLES.includes(normalizedRole) || normalizedRole === "owner") {
      throw new Error("Role must be moderator or member. Use ownership transfer for owner role.");
    }
    const target = q.member.get(room.code, targetUserId);
    if (!target) throw new Error("Target user is not a member of this room.");
    if (target.role === "owner") throw new Error("The owner role cannot be changed this way.");
    q.updateMemberRole.run(normalizedRole, room.code, targetUserId);
    return roomSnapshot(room.code, actorUserId);
  }

  function transferOwnership({ code, actorUserId, targetUserId }) {
    const { room, membership: actor } = requireMembership(code, actorUserId);
    if (actor.role !== "owner") throw new Error("Only the room owner can transfer ownership.");
    if (targetUserId === actorUserId) throw new Error("You already own this room.");
    const target = q.member.get(room.code, targetUserId);
    if (!target) throw new Error("Target user is not a member of this room.");

    db.exec("BEGIN IMMEDIATE;");
    try {
      q.updateMemberRole.run("member", room.code, actorUserId);
      q.updateMemberRole.run("owner", room.code, targetUserId);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
    return roomSnapshot(room.code, actorUserId);
  }

  function removeMember({ code, actorUserId, targetUserId }) {
    const { room, membership: actor } = requireMembership(code, actorUserId);
    if (targetUserId === actorUserId) throw new Error("Use leave room to remove yourself.");
    const target = q.member.get(room.code, targetUserId);
    if (!target) throw new Error("Target user is not a member of this room.");
    if (!canManageMember(actor.role, target.role)) throw new Error("You do not have permission to remove this member.");
    q.deleteMember.run(room.code, targetUserId);
    return roomSnapshot(room.code, actorUserId);
  }

  function roomSnapshot(code, userId) {
    const { room, membership } = requireMembership(code, userId);
    const participants = q.members.all(room.code).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      joinedAt: row.joined_at,
    }));
    const messages = q.messages.all(room.code).map((row) => ({
      id: row.id,
      roomCode: row.room_code,
      author: { id: row.author_id, displayName: row.author_display_name },
      statement: row.statement,
      committedAt: row.committed_at,
    }));
    return {
      code: room.code,
      name: room.name,
      createdAt: room.created_at,
      createdBy: room.created_by,
      membership: { role: membership.role, joinedAt: membership.joined_at },
      participants,
      messages,
    };
  }

  function listRoomsForUser(userId) {
    return q.roomsForUser.all(userId).map((row) => ({
      code: row.code,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
      joinedAt: row.joined_at,
    }));
  }

  function commitMessage({ code, userId, statement, approved }) {
    if (approved !== true) throw new Error("Speaker approval is required before commit.");
    const { room } = requireMembership(code, userId);
    const text = cleanText(statement, 20_000, "Statement");
    const committedAt = now();
    const id = makeId();
    q.insertMessage.run(id, room.code, userId, text, committedAt);
    const user = publicUser(q.userById.get(userId));
    return { id, roomCode: room.code, author: { id: user.id, displayName: user.displayName }, statement: text, committedAt };
  }

  function publicHistory(code, userId, limit = 8) {
    requireMembership(code, userId);
    return q.messages.all(String(code).toUpperCase()).slice(-limit).map((row) => ({
      speaker: row.author_display_name,
      statement: row.statement,
    }));
  }

  function close() { db.close(); }

  return {
    register,
    login,
    authenticate,
    logout,
    createRoom,
    joinRoom,
    leaveRoom,
    setMemberRole,
    transferOwnership,
    removeMember,
    roomSnapshot,
    listRoomsForUser,
    requireMembership,
    commitMessage,
    publicHistory,
    close,
    _db: db,
  };
}
