import { randomUUID } from "node:crypto";

export function createFederationEventStore(db, { makeId = randomUUID } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS federation_events (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('federated-retraction', 'federated-revision')),
      subject_uri TEXT NOT NULL UNIQUE,
      replacement_uri TEXT,
      event_uri TEXT NOT NULL UNIQUE,
      envelope_json TEXT NOT NULL,
      published_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_federation_events_room ON federation_events(room_code, published_at);
  `);

  const insert = db.prepare(`INSERT INTO federation_events
    (id, room_code, author_user_id, type, subject_uri, replacement_uri, event_uri, envelope_json, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const byId = db.prepare("SELECT * FROM federation_events WHERE id = ?");
  const bySubject = db.prepare("SELECT * FROM federation_events WHERE subject_uri = ?");
  const byRoom = db.prepare("SELECT * FROM federation_events WHERE room_code = ? ORDER BY published_at ASC, rowid ASC");

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      roomCode: row.room_code,
      authorUserId: row.author_user_id,
      type: row.type,
      subjectUri: row.subject_uri,
      replacementUri: row.replacement_uri || null,
      eventUri: row.event_uri,
      envelope: JSON.parse(row.envelope_json),
      publishedAt: row.published_at,
    };
  }

  function nextId() {
    return String(makeId());
  }

  function record({ id, roomCode, authorUserId, envelope }) {
    const eventId = String(id || "").trim();
    if (!eventId) throw new Error("Federation event id is required.");
    if (byId.get(eventId)) throw new Error("Federation event id already exists.");
    const subjectUri = String(envelope?.subject || "").trim();
    if (!subjectUri) throw new Error("Federation event subject is required.");
    if (bySubject.get(subjectUri)) throw new Error("This federated utterance already has a direct retraction or revision event.");
    const item = {
      id: eventId,
      roomCode: String(roomCode || "").trim().toUpperCase(),
      authorUserId: String(authorUserId || "").trim(),
      type: String(envelope?.type || ""),
      subjectUri,
      replacementUri: envelope?.replacement ? String(envelope.replacement) : null,
      eventUri: String(envelope?.id || ""),
      envelope,
      publishedAt: String(envelope?.publishedAt || ""),
    };
    insert.run(
      item.id,
      item.roomCode,
      item.authorUserId,
      item.type,
      item.subjectUri,
      item.replacementUri,
      item.eventUri,
      JSON.stringify(item.envelope),
      item.publishedAt,
    );
    return item;
  }

  function getById(id) { return map(byId.get(String(id || ""))); }
  function getBySubject(subjectUri) { return map(bySubject.get(String(subjectUri || ""))); }
  function listByRoom(roomCode) { return byRoom.all(String(roomCode || "").toUpperCase()).map(map); }

  return { nextId, record, getById, getBySubject, listByRoom };
}
