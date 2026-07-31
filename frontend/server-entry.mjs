import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const { default: appHandler } = await import("./server.js");

const CLIENT_DIR = join(process.cwd(), ".output", "client");
const PUBLIC_DIR = join(process.cwd(), "public");

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
};

function serveStatic(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  let filePath = join(CLIENT_DIR, url.pathname);
  if (!existsSync(filePath)) filePath = join(PUBLIC_DIR, url.pathname);
  if (!existsSync(filePath)) return null;

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  try {
    const body = readFileSync(filePath);
    return new Response(body, {
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return null;
  }
}

const server = createServer(async (nodeReq, nodeRes) => {
  try {
    const host = nodeReq.headers.host || `localhost:${PORT}`;
    const url = `http://${host}${nodeReq.url}`;

    if (nodeReq.method === "GET" || nodeReq.method === "HEAD") {
      const staticResponse = serveStatic(nodeReq.url);
      if (staticResponse) {
        const headers = {};
        staticResponse.headers.forEach((value, key) => { headers[key] = value; });
        nodeRes.writeHead(staticResponse.status, headers);
        if (staticResponse.body) {
          for await (const chunk of staticResponse.body) nodeRes.write(chunk);
        }
        nodeRes.end();
        return;
      }
    }

    const bodyChunks = [];
    if (!["GET", "HEAD", "OPTIONS"].includes(nodeReq.method ?? "GET")) {
      for await (const chunk of nodeReq) bodyChunks.push(chunk);
    }

    const request = new Request(url, {
      method: nodeReq.method ?? "GET",
      headers: Object.entries(nodeReq.headers).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, String(v ?? "")]]
      ),
      body: bodyChunks.length ? Buffer.concat(bodyChunks) : undefined,
      ...(bodyChunks.length ? { duplex: "half" } : {}),
    });

    const response = await appHandler.fetch(request, {}, {});
    const headers = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    nodeRes.writeHead(response.status, headers);
    if (response.body) {
      for await (const chunk of response.body) nodeRes.write(chunk);
    }
    nodeRes.end();
  } catch (err) {
    console.error("[serve] Unhandled error:", err);
    nodeRes.writeHead(500, { "content-type": "text/plain" });
    nodeRes.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend running at http://localhost:${PORT}`);
});
