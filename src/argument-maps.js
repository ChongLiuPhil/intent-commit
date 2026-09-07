import { randomUUID } from "node:crypto";

export function createArgumentMapStore(db, { makeId = randomUUID } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS argument_maps (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      room_code TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      subject_uri TEXT NOT NULL UNIQUE,
      map_uri TEXT NOT NULL UNIQUE,
      envelope_json TEXT NOT NULL,
      published_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_argument_maps_room ON argument_maps(room_code, published_at);
    CREATE INDEX IF NOT EXISTS idx_argument_maps_author ON argument_maps(author_user_id, published_at);
  `);

  const insert = db.prepare(`INSERT INTO argument_maps
    (id, message_id, room_code, author_user_id, subject_uri, map_uri, envelope_json, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const byId = db.prepare("SELECT * FROM argument_maps WHERE id = ?");
  const byMessageId = db.prepare("SELECT * FROM argument_maps WHERE message_id = ?");
  const bySubject = db.prepare("SELECT * FROM argument_maps WHERE subject_uri = ?");
  const byRoom = db.prepare("SELECT * FROM argument_maps WHERE room_code = ? ORDER BY published_at ASC, rowid ASC");
  const all = db.prepare("SELECT * FROM argument_maps ORDER BY published_at ASC, rowid ASC");

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      messageId: row.message_id,
      roomCode: row.room_code,
      authorUserId: row.author_user_id,
      subjectUri: row.subject_uri,
      mapUri: row.map_uri,
      envelope: JSON.parse(row.envelope_json),
      publishedAt: row.published_at,
    };
  }

  function nextId() {
    return String(makeId());
  }

  function record({ id, messageId, roomCode, authorUserId, envelope }) {
    const mapId = String(id || "").trim();
    if (!mapId) throw new Error("Argument map id is required.");
    if (byId.get(mapId)) throw new Error("Argument map id already exists.");
    const normalizedMessageId = String(messageId || "").trim();
    if (!normalizedMessageId) throw new Error("Argument map message id is required.");
    if (byMessageId.get(normalizedMessageId)) throw new Error("This federated utterance already has an argument map.");
    const subjectUri = String(envelope?.subject || "").trim();
    const mapUri = String(envelope?.id || "").trim();
    if (!subjectUri || !mapUri) throw new Error("Argument map subject and canonical URI are required.");
    if (bySubject.get(subjectUri)) throw new Error("This federated utterance already has an argument map.");

    const item = {
      id: mapId,
      messageId: normalizedMessageId,
      roomCode: String(roomCode || "").trim().toUpperCase(),
      authorUserId: String(authorUserId || "").trim(),
      subjectUri,
      mapUri,
      envelope,
      publishedAt: String(envelope?.publishedAt || ""),
    };
    insert.run(
      item.id,
      item.messageId,
      item.roomCode,
      item.authorUserId,
      item.subjectUri,
      item.mapUri,
      JSON.stringify(item.envelope),
      item.publishedAt,
    );
    return item;
  }

  function getById(id) { return map(byId.get(String(id || ""))); }
  function getByMessageId(messageId) { return map(byMessageId.get(String(messageId || ""))); }
  function getBySubject(subjectUri) { return map(bySubject.get(String(subjectUri || ""))); }
  function listByRoom(roomCode) { return byRoom.all(String(roomCode || "").toUpperCase()).map(map); }
  function listAll() { return all.all().map(map); }

  return { nextId, record, getById, getByMessageId, getBySubject, listByRoom, listAll };
}
