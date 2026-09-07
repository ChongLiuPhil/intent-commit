import { randomUUID } from "node:crypto";

export function createFederationPublicationStore(db, { now = () => new Date().toISOString(), makeId = randomUUID } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS federation_publications (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      room_code TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      canonical_uri TEXT NOT NULL UNIQUE,
      envelope_json TEXT NOT NULL,
      published_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_federation_publications_room ON federation_publications(room_code, published_at);
  `);

  const insert = db.prepare(`INSERT INTO federation_publications
    (id, message_id, room_code, author_user_id, canonical_uri, envelope_json, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const byMessage = db.prepare("SELECT * FROM federation_publications WHERE message_id = ?");
  const byRoom = db.prepare("SELECT * FROM federation_publications WHERE room_code = ? ORDER BY published_at ASC, rowid ASC");
  const all = db.prepare("SELECT * FROM federation_publications ORDER BY published_at ASC, rowid ASC");

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      messageId: row.message_id,
      roomCode: row.room_code,
      authorUserId: row.author_user_id,
      canonicalUri: row.canonical_uri,
      envelope: JSON.parse(row.envelope_json),
      publishedAt: row.published_at,
    };
  }

  function record({ messageId, roomCode, authorUserId, canonicalUri, envelope }) {
    if (byMessage.get(messageId)) throw new Error("This committed message has already been published to federation.");
    const publishedAt = String(envelope?.publishedAt || now());
    const item = {
      id: makeId(),
      messageId: String(messageId || ""),
      roomCode: String(roomCode || "").toUpperCase(),
      authorUserId: String(authorUserId || ""),
      canonicalUri: String(canonicalUri || ""),
      envelope,
      publishedAt,
    };
    insert.run(item.id, item.messageId, item.roomCode, item.authorUserId, item.canonicalUri, JSON.stringify(envelope), item.publishedAt);
    return item;
  }

  function getByMessageId(messageId) { return map(byMessage.get(String(messageId || ""))); }
  function listByRoom(roomCode) { return byRoom.all(String(roomCode || "").toUpperCase()).map(map); }
  function listAll() { return all.all().map(map); }

  return { record, getByMessageId, listByRoom, listAll };
}
