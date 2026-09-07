import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoReflect } from "./src/reflector.js";
import { reflectWithOpenAI } from "./src/openai.js";
import { demoSuggestArgumentStructure, suggestArgumentStructureWithOpenAI } from "./src/argument-suggestions.js";
import { createPersistentStore } from "./src/store.js";
import { createExternalPublicationStore } from "./src/external-publications.js";
import { createFederationPublicationStore } from "./src/federation-publications.js";
import { createFederationEventStore } from "./src/federation-events.js";
import { createProvenanceEdgeStore } from "./src/provenance-edges.js";
import { createArgumentMapStore } from "./src/argument-maps.js";
import { ensureFederationIdentity } from "./src/federation-identity.js";
import { createCommittedMessage, PROTOCOL_VERSION } from "./packages/protocol/index.js";
import { normalizeRepository, publishIssueComment } from "./packages/adapters-github/index.js";
import {
  createFederatedUtterance,
  createFederatedRetraction,
  createFederatedRevision,
  createFederatedProvenanceEdge,
  createFederatedArgumentMap,
  createInstanceDescriptor,
  FEDERATION_VERSION,
  RETRACTION_TYPE,
  REVISION_TYPE,
  normalizeIssuer,
} from "./packages/federation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

async function loadLocalEnv() {
  try {
    const text = await readFile(path.join(__dirname, ".env"), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index < 1) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("Could not read .env:", error.message);
  }
}

await loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const sessionTtlDays = Math.max(1, Number(process.env.SESSION_TTL_DAYS || 30));
const cookieSecure = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "data", "intent-commit.sqlite");
const federationEnabled = String(process.env.FEDERATION_ENABLED || "false").toLowerCase() === "true";
const federationIssuer = federationEnabled ? normalizeIssuer(process.env.PUBLIC_BASE_URL) : null;
const federationPrivateKeyPath = process.env.FEDERATION_PRIVATE_KEY_PATH || path.join(__dirname, "data", "federation-private.pem");
const federationPublicKeyPath = process.env.FEDERATION_PUBLIC_KEY_PATH || path.join(__dirname, "data", "federation-public.pem");

const store = createPersistentStore({ dbPath: databasePath, sessionTtlDays });
const externalPublications = createExternalPublicationStore(store._db);
const federationPublications = createFederationPublicationStore(store._db);
const federationEvents = createFederationEventStore(store._db);
const provenanceEdges = createProvenanceEdgeStore(store._db);
const argumentMaps = createArgumentMapStore(store._db);
const federationIdentity = federationEnabled
  ? ensureFederationIdentity({ privateKeyPath: federationPrivateKeyPath, publicKeyPath: federationPublicKeyPath })
  : null;
const subscribers = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request too large.");
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
}

function parseCookies(req) {
  const cookies = {};
  for (const pair of String(req.headers.cookie || "").split(";")) {
    const index = pair.indexOf("=");
    if (index < 1) continue;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return cookies;
}

function sessionToken(req) { return parseCookies(req).intent_commit_session || ""; }

function sessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  return [
    `intent_commit_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
    cookieSecure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function clearSessionCookie() {
  return ["intent_commit_session=", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0", cookieSecure ? "Secure" : ""].filter(Boolean).join("; ");
}

function requireAuth(req) { return store.authenticate(sessionToken(req)).user; }

function statusFor(error) {
  const message = String(error?.message || "");
  if (/Authentication required|Invalid room session/i.test(message)) return 401;
  if (/not a member|permission|only the room owner|owner must transfer|original author/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/already registered|already been published|already has a direct|already exists|revision would create a cycle|provenance edge already exists|already has an argument map/i.test(message)) return 409;
  return 400;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastRoom(code) {
  const normalized = String(code || "").toUpperCase();
  const set = subscribers.get(normalized);
  if (!set) return;
  for (const client of [...set]) {
    try {
      sseWrite(client.res, "snapshot", store.roomSnapshot(normalized, client.userId));
    } catch {
      set.delete(client);
      client.res.end();
    }
  }
  if (!set.size) subscribers.delete(normalized);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const candidate = path.normalize(path.join(publicDir, pathname));
  if (!candidate.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(candidate);
    res.writeHead(200, { "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function federationPublicationSummary(item) {
  return { messageId: item.messageId, canonicalUri: item.canonicalUri, publishedAt: item.publishedAt };
}

function federationEventSummary(item) {
  return {
    id: item.id,
    type: item.type,
    subjectUri: item.subjectUri,
    replacementUri: item.replacementUri,
    eventUri: item.eventUri,
    publishedAt: item.publishedAt,
  };
}

function provenanceEdgeSummary(item) {
  return {
    id: item.id,
    predicate: item.predicate,
    sourceUri: item.sourceUri,
    targetUri: item.targetUri,
    edgeUri: item.edgeUri,
    publishedAt: item.publishedAt,
  };
}

function argumentMapSummary(item) {
  return {
    id: item.id,
    messageId: item.messageId,
    subjectUri: item.subjectUri,
    mapUri: item.mapUri,
    publishedAt: item.publishedAt,
  };
}

function ensureRevisionDoesNotCycle(subjectUri, replacementUri) {
  let cursor = replacementUri;
  const visited = new Set();
  while (cursor) {
    if (cursor === subjectUri || visited.has(cursor)) throw new Error("Revision would create a cycle.");
    visited.add(cursor);
    const relation = federationEvents.getBySubject(cursor);
    if (!relation) return;
    if (relation.type === RETRACTION_TYPE) throw new Error("A revision cannot point to an utterance that has been retracted.");
    cursor = relation.type === REVISION_TYPE ? relation.replacementUri : null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      version: "0.9.0",
      protocolVersion: PROTOCOL_VERSION,
      federation: { enabled: federationEnabled, version: FEDERATION_VERSION, issuer: federationIssuer },
      persistence: "sqlite",
      mode: process.env.OPENAI_API_KEY ? "openai" : "demo",
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || "gpt-5.6-luna") : null,
      adapters: { githubIssues: Boolean(process.env.GITHUB_TOKEN) },
    });
  }

  if (req.method === "GET" && pathname === "/.well-known/intent-commit") {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    return sendJson(res, 200, createInstanceDescriptor({ issuer: federationIssuer, publicKey: federationIdentity.publicKey, protocolVersion: PROTOCOL_VERSION }), {
      "Cache-Control": "public, max-age=300",
    });
  }

  if (req.method === "GET" && pathname === "/federation/graph") {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const nodes = federationPublications.listAll().map((item) => {
      const lifecycle = federationEvents.getBySubject(item.canonicalUri);
      const argumentMap = argumentMaps.getBySubject(item.canonicalUri);
      return {
        id: item.canonicalUri,
        messageId: item.messageId,
        author: item.envelope.message.author,
        statement: item.envelope.message.statement,
        committedAt: item.envelope.message.committedAt,
        publishedAt: item.publishedAt,
        lifecycle: lifecycle ? federationEventSummary(lifecycle) : null,
        argumentMap: argumentMap ? argumentMapSummary(argumentMap) : null,
      };
    });
    return sendJson(res, 200, {
      protocol: "intent-commit",
      federationVersion: FEDERATION_VERSION,
      nodes,
      edges: provenanceEdges.listAll().map((item) => item.envelope),
      argumentMaps: argumentMaps.listAll().map((item) => item.envelope),
    }, { "Content-Type": "application/intent-commit+json; charset=utf-8", "Cache-Control": "public, max-age=120" });
  }

  const publicArgumentMapMatch = pathname.match(/^\/federation\/arguments\/([^/]+)$/);
  if (req.method === "GET" && publicArgumentMapMatch) {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const argumentMap = argumentMaps.getById(decodeURIComponent(publicArgumentMapMatch[1]));
    if (!argumentMap) return sendJson(res, 404, { error: "Argument map not found." });
    return sendJson(res, 200, argumentMap.envelope, {
      "Content-Type": "application/intent-commit+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  }

  const publicProvenanceMatch = pathname.match(/^\/federation\/provenance\/([^/]+)$/);
  if (req.method === "GET" && publicProvenanceMatch) {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const edge = provenanceEdges.getById(decodeURIComponent(publicProvenanceMatch[1]));
    if (!edge) return sendJson(res, 404, { error: "Provenance edge not found." });
    return sendJson(res, 200, edge.envelope, {
      "Content-Type": "application/intent-commit+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  }

  const publicRelationsMatch = pathname.match(/^\/federation\/utterances\/([^/]+)\/relations$/);
  if (req.method === "GET" && publicRelationsMatch) {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const publication = federationPublications.getByMessageId(decodeURIComponent(publicRelationsMatch[1]));
    if (!publication) return sendJson(res, 404, { error: "Federated utterance not found." });
    const lifecycle = federationEvents.getBySubject(publication.canonicalUri);
    const argumentMap = argumentMaps.getBySubject(publication.canonicalUri);
    return sendJson(res, 200, {
      subject: publication.canonicalUri,
      relations: lifecycle ? [lifecycle.envelope] : [],
      provenance: {
        outgoing: provenanceEdges.listOutgoing(publication.canonicalUri).map((item) => item.envelope),
        incoming: provenanceEdges.listIncoming(publication.canonicalUri).map((item) => item.envelope),
      },
      argumentMap: argumentMap ? argumentMap.envelope : null,
    }, { "Content-Type": "application/intent-commit+json; charset=utf-8", "Cache-Control": "public, max-age=120" });
  }

  const publicUtteranceMatch = pathname.match(/^\/federation\/utterances\/([^/]+)$/);
  if (req.method === "GET" && publicUtteranceMatch) {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const publication = federationPublications.getByMessageId(decodeURIComponent(publicUtteranceMatch[1]));
    if (!publication) return sendJson(res, 404, { error: "Federated utterance not found." });
    return sendJson(res, 200, publication.envelope, {
      "Content-Type": "application/intent-commit+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  }

  const publicFederationEventMatch = pathname.match(/^\/federation\/events\/([^/]+)$/);
  if (req.method === "GET" && publicFederationEventMatch) {
    if (!federationEnabled) return sendJson(res, 404, { error: "Federation is disabled on this instance." });
    const event = federationEvents.getById(decodeURIComponent(publicFederationEventMatch[1]));
    if (!event) return sendJson(res, 404, { error: "Federation event not found." });
    return sendJson(res, 200, event.envelope, {
      "Content-Type": "application/intent-commit+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  }

  if (req.method === "POST" && pathname === "/api/register") {
    try {
      const body = await readJson(req);
      const result = store.register(body);
      return sendJson(res, 201, { user: result.user, rooms: [] }, { "Set-Cookie": sessionCookie(result.session.token, result.session.expiresAt) });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/login") {
    try {
      const body = await readJson(req);
      const result = store.login(body);
      return sendJson(res, 200, { user: result.user, rooms: store.listRoomsForUser(result.user.id) }, { "Set-Cookie": sessionCookie(result.session.token, result.session.expiresAt) });
    } catch (error) {
      return sendJson(res, 401, { error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    store.logout(sessionToken(req));
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    try {
      const user = requireAuth(req);
      return sendJson(res, 200, { user, rooms: store.listRoomsForUser(user.id) });
    } catch (error) {
      return sendJson(res, 401, { error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/rooms") {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const room = store.createRoom({ userId: user.id, roomName: body.roomName });
      broadcastRoom(room.code);
      return sendJson(res, 201, { room });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const joinMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/join$/);
  if (req.method === "POST" && joinMatch) {
    try {
      const user = requireAuth(req);
      const room = store.joinRoom({ code: joinMatch[1], userId: user.id });
      broadcastRoom(room.code);
      return sendJson(res, 200, { room });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const roleMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/members\/([^/]+)\/role$/);
  if (req.method === "PATCH" && roleMatch) {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const room = store.setMemberRole({ code: roleMatch[1], actorUserId: user.id, targetUserId: decodeURIComponent(roleMatch[2]), role: body.role });
      broadcastRoom(room.code);
      return sendJson(res, 200, { room });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const memberMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/members\/([^/]+)$/);
  if (req.method === "DELETE" && memberMatch) {
    try {
      const user = requireAuth(req);
      const room = store.removeMember({ code: memberMatch[1], actorUserId: user.id, targetUserId: decodeURIComponent(memberMatch[2]) });
      broadcastRoom(room.code);
      return sendJson(res, 200, { room });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const ownershipMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/ownership$/);
  if (req.method === "POST" && ownershipMatch) {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const room = store.transferOwnership({ code: ownershipMatch[1], actorUserId: user.id, targetUserId: String(body.targetUserId || "") });
      broadcastRoom(room.code);
      return sendJson(res, 200, { room });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const protocolMessagesMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/protocol\/messages$/);
  if (req.method === "GET" && protocolMessagesMatch) {
    try {
      const user = requireAuth(req);
      const room = store.roomSnapshot(protocolMessagesMatch[1], user.id);
      const messages = room.messages.map((message) => createCommittedMessage({
        id: message.id,
        roomCode: message.roomCode,
        author: message.author,
        statement: message.statement,
        committedAt: message.committedAt,
      }));
      return sendJson(res, 200, { protocolVersion: PROTOCOL_VERSION, messages });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const exportsMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/exports$/);
  if (req.method === "GET" && exportsMatch) {
    try {
      const user = requireAuth(req);
      store.roomSnapshot(exportsMatch[1], user.id);
      return sendJson(res, 200, { publications: externalPublications.list(exportsMatch[1]) });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const federationListMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation$/);
  if (req.method === "GET" && federationListMatch) {
    try {
      const user = requireAuth(req);
      store.roomSnapshot(federationListMatch[1], user.id);
      return sendJson(res, 200, {
        enabled: federationEnabled,
        issuer: federationIssuer,
        publications: federationPublications.listByRoom(federationListMatch[1]).map(federationPublicationSummary),
        events: federationEvents.listByRoom(federationListMatch[1]).map(federationEventSummary),
        provenance: provenanceEdges.listByRoom(federationListMatch[1]).map(provenanceEdgeSummary),
        argumentMaps: argumentMaps.listByRoom(federationListMatch[1]).map(argumentMapSummary),
      });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const federationPublishMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation\/publish$/);
  if (req.method === "POST" && federationPublishMatch) {
    try {
      const user = requireAuth(req);
      if (!federationEnabled) return sendJson(res, 503, { error: "Federation is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit federation-publication approval is required." });
      const room = store.roomSnapshot(federationPublishMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const message = room.messages.find((item) => item.id === messageId);
      if (!message) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may publish this committed message to federation." });
      const existing = federationPublications.getByMessageId(messageId);
      if (existing) return sendJson(res, 409, { error: "This committed message has already been published to federation.", publication: federationPublicationSummary(existing) });
      const committed = createCommittedMessage({ id: message.id, roomCode: message.roomCode, author: message.author, statement: message.statement, committedAt: message.committedAt });
      const envelope = createFederatedUtterance({ issuer: federationIssuer, message: committed, privateKey: federationIdentity.privateKey, publicKey: federationIdentity.publicKey });
      const publication = federationPublications.record({ messageId: message.id, roomCode: room.code, authorUserId: user.id, canonicalUri: envelope.id, envelope });
      return sendJson(res, 201, { publication: federationPublicationSummary(publication), envelope });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const federationRetractMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation\/retract$/);
  if (req.method === "POST" && federationRetractMatch) {
    try {
      const user = requireAuth(req);
      if (!federationEnabled) return sendJson(res, 503, { error: "Federation is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit retraction approval is required." });
      const room = store.roomSnapshot(federationRetractMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const message = room.messages.find((item) => item.id === messageId);
      if (!message) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may retract this federated utterance." });
      const publication = federationPublications.getByMessageId(messageId);
      if (!publication || publication.roomCode !== room.code) return sendJson(res, 404, { error: "Federated utterance not found." });
      if (federationEvents.getBySubject(publication.canonicalUri)) return sendJson(res, 409, { error: "This federated utterance already has a direct retraction or revision event." });
      const eventId = federationEvents.nextId();
      const envelope = createFederatedRetraction({
        issuer: federationIssuer,
        eventId,
        actor: message.author,
        subject: publication.canonicalUri,
        reason: String(body.reason || "").trim(),
        privateKey: federationIdentity.privateKey,
        publicKey: federationIdentity.publicKey,
      });
      const event = federationEvents.record({ id: eventId, roomCode: room.code, authorUserId: user.id, envelope });
      return sendJson(res, 201, { event: federationEventSummary(event), envelope });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const federationReviseMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation\/revise$/);
  if (req.method === "POST" && federationReviseMatch) {
    try {
      const user = requireAuth(req);
      if (!federationEnabled) return sendJson(res, 503, { error: "Federation is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit revision-link approval is required." });
      const room = store.roomSnapshot(federationReviseMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const replacementMessageId = String(body.replacementMessageId || "").trim();
      if (!messageId || !replacementMessageId || messageId === replacementMessageId) return sendJson(res, 400, { error: "Revision requires a different replacement message." });
      const message = room.messages.find((item) => item.id === messageId);
      const replacementMessage = room.messages.find((item) => item.id === replacementMessageId);
      if (!message || !replacementMessage) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id || replacementMessage.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may create a revision between their federated utterances." });
      const publication = federationPublications.getByMessageId(messageId);
      const replacementPublication = federationPublications.getByMessageId(replacementMessageId);
      if (!publication || publication.roomCode !== room.code) return sendJson(res, 404, { error: "Original federated utterance not found." });
      if (!replacementPublication || replacementPublication.roomCode !== room.code) return sendJson(res, 400, { error: "The replacement must first be independently published to federation." });
      if (federationEvents.getBySubject(publication.canonicalUri)) return sendJson(res, 409, { error: "This federated utterance already has a direct retraction or revision event." });
      ensureRevisionDoesNotCycle(publication.canonicalUri, replacementPublication.canonicalUri);
      const eventId = federationEvents.nextId();
      const envelope = createFederatedRevision({
        issuer: federationIssuer,
        eventId,
        actor: message.author,
        subject: publication.canonicalUri,
        replacement: replacementPublication.canonicalUri,
        reason: String(body.reason || "").trim(),
        privateKey: federationIdentity.privateKey,
        publicKey: federationIdentity.publicKey,
      });
      const event = federationEvents.record({ id: eventId, roomCode: room.code, authorUserId: user.id, envelope });
      return sendJson(res, 201, { event: federationEventSummary(event), envelope });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const provenancePublishMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation\/provenance$/);
  if (req.method === "POST" && provenancePublishMatch) {
    try {
      const user = requireAuth(req);
      if (!federationEnabled) return sendJson(res, 503, { error: "Federation is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit provenance-publication approval is required." });
      const room = store.roomSnapshot(provenancePublishMatch[1], user.id);
      const sourceMessageId = String(body.sourceMessageId || "").trim();
      const targetMessageId = String(body.targetMessageId || "").trim();
      const sourceMessage = room.messages.find((item) => item.id === sourceMessageId);
      if (!sourceMessage) return sendJson(res, 404, { error: "Source committed message not found in this room." });
      if (sourceMessage.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author of the source utterance may assert its provenance relation." });
      const sourcePublication = federationPublications.getByMessageId(sourceMessageId);
      const targetPublication = federationPublications.getByMessageId(targetMessageId);
      if (!sourcePublication || sourcePublication.roomCode !== room.code) return sendJson(res, 400, { error: "The source must first be independently published to federation." });
      if (!targetPublication) return sendJson(res, 400, { error: "The target must already be a federated utterance on this instance." });
      const edgeId = provenanceEdges.nextId();
      const envelope = createFederatedProvenanceEdge({
        issuer: federationIssuer,
        edgeId,
        actor: sourceMessage.author,
        source: sourcePublication.canonicalUri,
        target: targetPublication.canonicalUri,
        predicate: body.predicate,
        note: String(body.note || "").trim(),
        privateKey: federationIdentity.privateKey,
        publicKey: federationIdentity.publicKey,
      });
      const edge = provenanceEdges.record({ id: edgeId, roomCode: room.code, authorUserId: user.id, envelope });
      return sendJson(res, 201, { edge: provenanceEdgeSummary(edge), envelope });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const argumentSuggestMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/arguments\/suggest$/);
  if (req.method === "POST" && argumentSuggestMatch) {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const room = store.roomSnapshot(argumentSuggestMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const message = room.messages.find((item) => item.id === messageId);
      if (!message) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may request a private argument-structure suggestion for this utterance." });
      const publication = federationPublications.getByMessageId(messageId);
      if (!publication || publication.roomCode !== room.code) return sendJson(res, 400, { error: "The utterance must first be independently published to federation." });
      if (argumentMaps.getByMessageId(messageId)) return sendJson(res, 409, { error: "This federated utterance already has an argument map." });
      const structure = process.env.OPENAI_API_KEY
        ? await suggestArgumentStructureWithOpenAI({ statement: message.statement })
        : demoSuggestArgumentStructure(message.statement);
      return sendJson(res, 200, { mode: process.env.OPENAI_API_KEY ? "openai" : "demo", structure });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error?.message || "Argument-structure suggestion failed." });
    }
  }

  const argumentPublishMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/federation\/arguments$/);
  if (req.method === "POST" && argumentPublishMatch) {
    try {
      const user = requireAuth(req);
      if (!federationEnabled) return sendJson(res, 503, { error: "Federation is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit argument-map publication approval is required." });
      const room = store.roomSnapshot(argumentPublishMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const message = room.messages.find((item) => item.id === messageId);
      if (!message) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may publish an argument map for this utterance." });
      const publication = federationPublications.getByMessageId(messageId);
      if (!publication || publication.roomCode !== room.code) return sendJson(res, 400, { error: "The utterance must first be independently published to federation." });
      const existing = argumentMaps.getByMessageId(messageId);
      if (existing) return sendJson(res, 409, { error: "This federated utterance already has an argument map.", argumentMap: argumentMapSummary(existing) });
      const mapId = argumentMaps.nextId();
      const envelope = createFederatedArgumentMap({
        issuer: federationIssuer,
        mapId,
        actor: message.author,
        subject: publication.canonicalUri,
        nodes: body.nodes,
        edges: body.edges,
        privateKey: federationIdentity.privateKey,
        publicKey: federationIdentity.publicKey,
      });
      const argumentMap = argumentMaps.record({ id: mapId, messageId, roomCode: room.code, authorUserId: user.id, envelope });
      return sendJson(res, 201, { argumentMap: argumentMapSummary(argumentMap), envelope });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const githubPublishMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/adapters\/github\/issues\/(\d+)\/publish$/);
  if (req.method === "POST" && githubPublishMatch) {
    try {
      const user = requireAuth(req);
      if (!process.env.GITHUB_TOKEN) return sendJson(res, 503, { error: "GitHub adapter is not configured on this server." });
      const body = await readJson(req);
      if (body.approved !== true) return sendJson(res, 400, { error: "Explicit external-publication approval is required." });
      const room = store.roomSnapshot(githubPublishMatch[1], user.id);
      const messageId = String(body.messageId || "").trim();
      const message = room.messages.find((item) => item.id === messageId);
      if (!message) return sendJson(res, 404, { error: "Committed message not found." });
      if (message.author.id !== user.id) return sendJson(res, 403, { error: "Only the original author may publish this committed message externally." });
      const repository = normalizeRepository(body.repository);
      const issueNumber = Number(githubPublishMatch[2]);
      const target = `${repository}#${issueNumber}`;
      const existing = externalPublications.get({ adapter: "github-issues", target, messageId });
      if (existing) return sendJson(res, 409, { error: "This committed message has already been published to that target.", publication: existing });
      const envelope = createCommittedMessage({ id: message.id, roomCode: message.roomCode, author: message.author, statement: message.statement, committedAt: message.committedAt });
      let external;
      try {
        external = await publishIssueComment({ token: process.env.GITHUB_TOKEN, repository, issueNumber, message: envelope });
      } catch (error) {
        return sendJson(res, 502, { error: error.message });
      }
      const publication = externalPublications.record({
        roomCode: room.code,
        messageId: message.id,
        authorUserId: user.id,
        adapter: "github-issues",
        target,
        externalId: external.id,
        externalUrl: external.htmlUrl || external.apiUrl,
      });
      return sendJson(res, 201, { publication, external });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
  if (req.method === "GET" && roomMatch) {
    try {
      const user = requireAuth(req);
      return sendJson(res, 200, { room: store.roomSnapshot(roomMatch[1], user.id) });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const eventMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/events$/);
  if (req.method === "GET" && eventMatch) {
    try {
      const user = requireAuth(req);
      const room = store.roomSnapshot(eventMatch[1], user.id);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 3000\n\n");
      sseWrite(res, "snapshot", room);
      const client = { res, userId: user.id };
      const set = subscribers.get(room.code) || new Set();
      set.add(client);
      subscribers.set(room.code, set);
      const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 25_000);
      req.on("close", () => {
        clearInterval(keepAlive);
        set.delete(client);
        if (!set.size) subscribers.delete(room.code);
      });
      return;
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const commitMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/commit$/);
  if (req.method === "POST" && commitMatch) {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const message = store.commitMessage({ code: commitMatch[1], userId: user.id, statement: body.statement, approved: body.approved });
      broadcastRoom(message.roomCode);
      return sendJson(res, 201, { message });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  const leaveMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/leave$/);
  if (req.method === "POST" && leaveMatch) {
    try {
      const user = requireAuth(req);
      const result = store.leaveRoom({ code: leaveMatch[1], userId: user.id });
      broadcastRoom(result.code);
      return sendJson(res, 200, { ok: true, deleted: result.deleted });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/reflect") {
    try {
      const user = requireAuth(req);
      const body = await readJson(req);
      const draft = String(body.draft || "").trim();
      const clarification = String(body.clarification || "").trim();
      const roomCode = String(body.roomCode || "").trim().toUpperCase();
      if (!draft) return sendJson(res, 400, { error: "Draft is required." });
      if (draft.length > 20_000 || clarification.length > 10_000) return sendJson(res, 400, { error: "Draft or clarification is too long." });
      const history = roomCode ? store.publicHistory(roomCode, user.id, 8) : [];
      if (process.env.OPENAI_API_KEY) {
        const card = await reflectWithOpenAI({ draft, clarification, history });
        return sendJson(res, 200, { mode: "openai", card });
      }
      return sendJson(res, 200, { mode: "demo", card: demoReflect({ draft, clarification }) });
    } catch (error) {
      return sendJson(res, statusFor(error), { error: error?.message || "Reflection failed." });
    }
  }

  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Intent Commit v0.9 running at http://localhost:${port}`);
  console.log(`Protocol: ${PROTOCOL_VERSION}`);
  console.log(`SQLite: ${databasePath}`);
  console.log(process.env.OPENAI_API_KEY ? "Reflection mode: OpenAI" : "Reflection mode: deterministic demo");
  console.log(process.env.GITHUB_TOKEN ? "GitHub Issues adapter: enabled" : "GitHub Issues adapter: disabled");
  console.log(federationEnabled ? `Federation: enabled as ${federationIssuer}` : "Federation: disabled");
});

function shutdown() {
  for (const set of subscribers.values()) for (const client of set) client.res.end();
  store.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
