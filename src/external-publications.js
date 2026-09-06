import { randomUUID } from "node:crypto";

export function createExternalPublicationStore(db, { now = () => new Date().toISOString(), makeId = randomUUID } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_publications (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      adapter TEXT NOT NULL,
      target TEXT NOT NULL,
      external_id TEXT,
      external_url TEXT NOT NULL,
      published_at TEXT NOT NULL,
      UNIQUE (adapter, target, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_external_publications_room ON external_publications(room_code, published_at);
  `);

  const insert = db.prepare(`INSERT INTO external_publications
    (id, room_code, message_id, author_user_id, adapter, target, external_id, external_url, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const byRoom = db.prepare(`SELECT id, room_code, message_id, author_user_id, adapter, target, external_id, external_url, published_at
    FROM external_publications WHERE room_code = ? ORDER BY published_at ASC, rowid ASC`);
  const duplicate = db.prepare(`SELECT * FROM external_publications WHERE adapter = ? AND target = ? AND message_id = ?`);

  function record({ roomCode, messageId, authorUserId, adapter, target, externalId = "", externalUrl }) {
    if (duplicate.get(adapter, target, messageId)) {
      throw new Error("This committed message has already been published to that target.");
    }
    const item = {
      id: makeId(),
      roomCode: String(roomCode || "").toUpperCase(),
      messageId: String(messageId || ""),
      authorUserId: String(authorUserId || ""),
      adapter: String(adapter || ""),
      target: String(target || ""),
      externalId: String(externalId || ""),
      externalUrl: String(externalUrl || ""),
      publishedAt: now(),
    };
    insert.run(item.id, item.roomCode, item.messageId, item.authorUserId, item.adapter, item.target, item.externalId, item.externalUrl, item.publishedAt);
    return item;
  }

  function list(roomCode) {
    return byRoom.all(String(roomCode || "").toUpperCase()).map((row) => ({
      id: row.id,
      roomCode: row.room_code,
      messageId: row.message_id,
      authorUserId: row.author_user_id,
      adapter: row.adapter,
      target: row.target,
      externalId: row.external_id,
      externalUrl: row.external_url,
      publishedAt: row.published_at,
    }));
  }

  return { record, list };
}
