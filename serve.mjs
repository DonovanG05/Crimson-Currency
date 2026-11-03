import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(repoRoot, "site");
const port = Number(process.env.PORT || 8325);
const host = process.env.HOST || "0.0.0.0";

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

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(url.pathname);
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
});
