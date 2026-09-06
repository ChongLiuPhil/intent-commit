import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoReflect } from "./src/reflector.js";
import { reflectWithOpenAI } from "./src/openai.js";
import { createRoomStore } from "./src/rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const rooms = createRoomStore();
const subscribers = new Map();

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("Could not read .env:", error.message);
  }
}

await loadLocalEnv();
const port = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendApiError(res, error) {
  const message = error?.message || "Request failed.";
  const status = /not found/i.test(message) ? 404 : /invalid|required|too long|approval/i.test(message) ? 400 : 500;
  sendJson(res, status, { error: message });
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

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastSnapshot(roomCode) {
  const group = subscribers.get(roomCode);
  if (!group?.size) return;

  for (const client of [...group]) {
    try {
      const snapshot = rooms.getSnapshot(roomCode, client.participantToken);
      sendEvent(client.res, "snapshot", snapshot);
    } catch {
      group.delete(client);
      client.res.end();
    }
  }

  if (!group.size) subscribers.delete(roomCode);
}

function subscribeToRoom(req, res, roomCode, participantToken) {
  rooms.authenticate(roomCode, participantToken);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  const client = { res, participantToken };
  const group = subscribers.get(roomCode) || new Set();
  group.add(client);
  subscribers.set(roomCode, group);

  sendEvent(res, "snapshot", rooms.getSnapshot(roomCode, participantToken));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    group.delete(client);
    if (!group.size) subscribers.delete(roomCode);
  });
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
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      version: "0.2.0",
      realtime: "sse",
      storage: "memory",
      mode: process.env.OPENAI_API_KEY ? "openai" : "demo",
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || "gpt-5.6-luna") : null,
    });
  }

  if (req.method === "POST" && pathname === "/api/rooms") {
    try {
      const body = await readJson(req);
      const result = rooms.createRoom({ displayName: body.displayName, roomName: body.roomName });
      return sendJson(res, 201, result);
    } catch (error) {
      return sendApiError(res, error);
    }
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/(join|commit|leave|events))?$/);
  if (roomMatch) {
    const roomCode = roomMatch[1].toUpperCase();
    const action = roomMatch[2] || "snapshot";

    try {
      if (req.method === "POST" && action === "join") {
        const body = await readJson(req);
        const result = rooms.joinRoom({ code: roomCode, displayName: body.displayName });
        sendJson(res, 200, result);
        broadcastSnapshot(roomCode);
        return;
      }

      if (req.method === "GET" && action === "snapshot") {
        const token = url.searchParams.get("token");
        return sendJson(res, 200, { room: rooms.getSnapshot(roomCode, token) });
      }

      if (req.method === "GET" && action === "events") {
        const token = url.searchParams.get("token");
        return subscribeToRoom(req, res, roomCode, token);
      }

      if (req.method === "POST" && action === "commit") {
        const body = await readJson(req);
        const message = rooms.commitMessage({
          code: roomCode,
          participantToken: body.participantToken,
          statement: body.statement,
          approved: body.approved,
        });
        sendJson(res, 201, { message });
        broadcastSnapshot(roomCode);
        return;
      }

      if (req.method === "POST" && action === "leave") {
        const body = await readJson(req);
        rooms.leaveRoom({ code: roomCode, participantToken: body.participantToken });
        sendJson(res, 200, { ok: true });
        broadcastSnapshot(roomCode);
        return;
      }
    } catch (error) {
      return sendApiError(res, error);
    }
  }

  if (req.method === "POST" && pathname === "/api/reflect") {
    try {
      const body = await readJson(req);
      const draft = String(body.draft || "").trim();
      const clarification = String(body.clarification || "").trim();
      const roomCode = String(body.roomCode || "").trim().toUpperCase();
      const participantToken = String(body.participantToken || "").trim();

      if (!draft) return sendJson(res, 400, { error: "Draft is required." });
      if (draft.length > 20_000 || clarification.length > 10_000) {
        return sendJson(res, 400, { error: "Draft or clarification is too long for this MVP." });
      }

      let history = [];
      if (roomCode || participantToken) {
        const snapshot = rooms.getSnapshot(roomCode, participantToken);
        history = snapshot.messages;
      }

      if (process.env.OPENAI_API_KEY) {
        const card = await reflectWithOpenAI({ draft, clarification, history });
        return sendJson(res, 200, { mode: "openai", card });
      }

      return sendJson(res, 200, { mode: "demo", card: demoReflect({ draft, clarification }) });
    } catch (error) {
      return sendApiError(res, error);
    }
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res);
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Intent Commit v0.2 running at http://localhost:${port}`);
  console.log("Multi-user rooms: enabled (in-memory + Server-Sent Events)");
  console.log(process.env.OPENAI_API_KEY ? "Reflection mode: OpenAI" : "Reflection mode: deterministic demo");
});
