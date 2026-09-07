import { randomUUID } from "node:crypto";

export function createProvenanceEdgeStore(db, { makeId = randomUUID } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provenance_edges (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      predicate TEXT NOT NULL CHECK(predicate IN ('cites', 'supports', 'challenges')),
      source_uri TEXT NOT NULL,
      target_uri TEXT NOT NULL,
      edge_uri TEXT NOT NULL UNIQUE,
      envelope_json TEXT NOT NULL,
      published_at TEXT NOT NULL,
      UNIQUE(source_uri, target_uri, predicate)
    );
    CREATE INDEX IF NOT EXISTS idx_provenance_edges_room ON provenance_edges(room_code, published_at);
    CREATE INDEX IF NOT EXISTS idx_provenance_edges_source ON provenance_edges(source_uri, published_at);
    CREATE INDEX IF NOT EXISTS idx_provenance_edges_target ON provenance_edges(target_uri, published_at);
  `);

  const insert = db.prepare(`INSERT INTO provenance_edges
    (id, room_code, author_user_id, predicate, source_uri, target_uri, edge_uri, envelope_json, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const byId = db.prepare("SELECT * FROM provenance_edges WHERE id = ?");
  const duplicate = db.prepare("SELECT * FROM provenance_edges WHERE source_uri = ? AND target_uri = ? AND predicate = ?");
  const byRoom = db.prepare("SELECT * FROM provenance_edges WHERE room_code = ? ORDER BY published_at ASC, rowid ASC");
  const outgoing = db.prepare("SELECT * FROM provenance_edges WHERE source_uri = ? ORDER BY published_at ASC, rowid ASC");
  const incoming = db.prepare("SELECT * FROM provenance_edges WHERE target_uri = ? ORDER BY published_at ASC, rowid ASC");
  const all = db.prepare("SELECT * FROM provenance_edges ORDER BY published_at ASC, rowid ASC");

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      roomCode: row.room_code,
      authorUserId: row.author_user_id,
      predicate: row.predicate,
      sourceUri: row.source_uri,
      targetUri: row.target_uri,
      edgeUri: row.edge_uri,
      envelope: JSON.parse(row.envelope_json),
      publishedAt: row.published_at,
    };
  }

  function nextId() {
    return String(makeId());
  }

  function record({ id, roomCode, authorUserId, envelope }) {
    const edgeId = String(id || "").trim();
    if (!edgeId) throw new Error("Provenance edge id is required.");
    if (byId.get(edgeId)) throw new Error("Provenance edge id already exists.");
    const predicate = String(envelope?.predicate || "").trim();
    const sourceUri = String(envelope?.source || "").trim();
    const targetUri = String(envelope?.target || "").trim();
    if (!sourceUri || !targetUri) throw new Error("Provenance edge source and target are required.");
    if (duplicate.get(sourceUri, targetUri, predicate)) throw new Error("This provenance edge already exists.");
    const item = {
      id: edgeId,
      roomCode: String(roomCode || "").trim().toUpperCase(),
      authorUserId: String(authorUserId || "").trim(),
      predicate,
      sourceUri,
      targetUri,
      edgeUri: String(envelope?.id || ""),
      envelope,
      publishedAt: String(envelope?.publishedAt || ""),
    };
    insert.run(
      item.id,
      item.roomCode,
      item.authorUserId,
      item.predicate,
      item.sourceUri,
      item.targetUri,
      item.edgeUri,
      JSON.stringify(item.envelope),
      item.publishedAt,
    );
    return item;
  }

  function getById(id) { return map(byId.get(String(id || ""))); }
  function listByRoom(roomCode) { return byRoom.all(String(roomCode || "").toUpperCase()).map(map); }
  function listOutgoing(sourceUri) { return outgoing.all(String(sourceUri || "")).map(map); }
  function listIncoming(targetUri) { return incoming.all(String(targetUri || "")).map(map); }
  function listAll() { return all.all().map(map); }

  return { nextId, record, getById, listByRoom, listOutgoing, listIncoming, listAll };
}
