import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoReflect } from "./src/reflector.js";
import { reflectWithOpenAI } from "./src/openai.js";

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
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      mode: process.env.OPENAI_API_KEY ? "openai" : "demo",
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || "gpt-5.6-luna") : null,
    });
  }

  if (req.method === "POST" && req.url === "/api/reflect") {
    try {
      const body = await readJson(req);
      const draft = String(body.draft || "").trim();
      const clarification = String(body.clarification || "").trim();
      const history = Array.isArray(body.history) ? body.history : [];

      if (!draft) return sendJson(res, 400, { error: "Draft is required." });
      if (draft.length > 20_000 || clarification.length > 10_000) {
        return sendJson(res, 400, { error: "Draft or clarification is too long for this MVP." });
      }

      if (process.env.OPENAI_API_KEY) {
        const card = await reflectWithOpenAI({ draft, clarification, history });
        return sendJson(res, 200, { mode: "openai", card });
      }

      return sendJson(res, 200, { mode: "demo", card: demoReflect({ draft, clarification }) });
    } catch (error) {
      return sendJson(res, 500, { error: error?.message || "Reflection failed." });
    }
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res);
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Intent Commit running at http://localhost:${port}`);
  console.log(process.env.OPENAI_API_KEY ? "Reflection mode: OpenAI" : "Reflection mode: deterministic demo");
});
