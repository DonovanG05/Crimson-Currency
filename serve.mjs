import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
// SITE_ROOT lets the deployment on Money serve dist/ while a fresh clone
// serves site/ — same server code either way.
const siteRoot = process.env.SITE_ROOT ? resolve(process.env.SITE_ROOT) : join(repoRoot, "site");
const port = Number(process.env.PORT || 8325);
const host = process.env.HOST || "0.0.0.0";

// ---- AI advanced search (server-proxy mode) ----
// The Gemini API key lives ONLY in this process's environment
// (GEMINI_API_KEY), never in the repo and never sent to browsers. Visitors
// just ask; this server calls Google with its own key. Without the env var,
// /api/ask answers 501 and the page falls back to each visitor's own key
// (stored in their browser's localStorage).
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_SYSTEM = "You are the advanced search for Crimson Currency, a map of off-campus places near the University of Alabama in Tuscaloosa where students can pay with Bama Cash or Dining Dollars. Answer ONLY from the location list provided — never invent a place. A location with diningDollars:true accepts Dining Dollars (those places also accept Bama Cash and are tagged 'Both'); a location with diningDollars:false accepts Bama Cash only. Infer cuisine and food types from names and categories (for example, sushi from a Japanese restaurant's name). In 'answer', write a friendly reply that NAMES every matching location. In 'locationIds', return the id of every location that matches the question — all of them, not just examples. If nothing matches, say so in 'answer' and return an empty list. Mention currently unavailable locations only if asked about them, and flag them as unavailable in the answer.";

let LOCATIONS_CTX = [];
let VALID_IDS = new Set();
try {
  const raw = JSON.parse(await readFile(join(siteRoot, "locations.json"), "utf8"));
  LOCATIONS_CTX = raw.map(p => ({
    id: p.id, name: p.name, category: p.category, area: p.area || undefined,
    address: p.address, city: p.city || "Tuscaloosa",
    diningDollars: p.acceptsDiningDollars, bamaCash: p.acceptsBamaCash,
    unavailable: p.unavailable || undefined,
    hours: p.hoursVerified ? p.hours : undefined, note: p.note || undefined
  }));
  VALID_IDS = new Set(raw.map(p => p.id));
  console.log(`Loaded ${raw.length} locations for /api/ask`);
} catch (e) {
  console.error("Could not load locations.json for /api/ask:", e.message);
}

// Basic abuse guard for the shared server key: 30 questions per IP per hour.
const askHits = new Map();
function rateLimited(ip) {
  const now = Date.now(), hourMs = 3600e3;
  const arr = (askHits.get(ip) || []).filter(t => now - t < hourMs);
  if (arr.length >= 30) { askHits.set(ip, arr); return true; }
  arr.push(now); askHits.set(ip, arr); return false;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8");
}

async function handleAsk(req, res) {
  if (!GEMINI_KEY) {
    sendJson(res, 501, { error: "This server has no Gemini key configured." });
    return;
  }
  const ip = req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    sendJson(res, 429, { error: "Too many AI questions from your address — please try again later." });
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) { sendJson(res, 413, { error: "Question too long." }); return; }
  }
  let question = "";
  try { question = String(JSON.parse(body || "{}").question || "").trim(); }
  catch { sendJson(res, 400, { error: "Bad request." }); return; }
  if (!question) { sendJson(res, 400, { error: "Ask a question first." }); return; }
  if (question.length > 500) { sendJson(res, 400, { error: "Question too long (500 characters max)." }); return; }

  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
        contents: [{ parts: [{ text: "Locations (JSON):\n" + JSON.stringify(LOCATIONS_CTX) + "\n\nQuestion: " + question }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { answer: { type: "STRING" }, locationIds: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["answer", "locationIds"] }
        }
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error((data.error && data.error.message) || ("HTTP " + upstream.status));
    const out = JSON.parse(data.candidates[0].content.parts[0].text);
    const ids = (out.locationIds || []).filter(id => VALID_IDS.has(id));
    sendJson(res, 200, { answer: String(out.answer || ""), locationIds: ids });
  } catch (e) {
    console.error("/api/ask:", e.message);
    sendJson(res, 502, { error: "The AI search failed on the server (" + e.message + ")." });
  }
}

const server = createServer(async (req, res) => {
  let pathname = "";
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname);
  } catch { send(res, 400, "Bad request"); return; }

  if (pathname === "/api/ask") {
    if (req.method !== "POST") { send(res, 405, "Method not allowed"); return; }
    await handleAsk(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  try {
    if (pathname === "/") pathname = "/index.html";

    const relativePath = normalize(`.${pathname}`).replace(/^(\.\.(\/|\\|$))+/, "");
    let filePath = join(siteRoot, relativePath);
    if (!filePath.startsWith(siteRoot)) {
      send(res, 403, "Forbidden");
      return;
    }

    let fileStat = await stat(filePath).catch(() => null);
    if (fileStat?.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath).catch(() => null);
    }
    if (!fileStat?.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const body = req.method === "HEAD" ? "" : await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (error) {
    console.error(error);
    send(res, 500, "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Crimson Currency is running at http://localhost:${port}`);
  console.log(`Serving ${siteRoot}`);
  console.log(GEMINI_KEY ? "AI search: server key configured (/api/ask on)" : "AI search: no GEMINI_API_KEY set (/api/ask off, browser-key fallback)");
});
