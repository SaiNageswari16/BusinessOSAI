import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const { default: appHandler } = await import("./server.js");

const CLIENT_DIR = join(process.cwd(), ".output", "client");
const PUBLIC_DIR = join(process.cwd(), "public");
const UPLOAD_IMAGES_DIR = join(process.cwd(), "..", "backend", "upload_images");
const BACKEND_UPLOAD_DIR = join(process.cwd(), "backend", "upload_images");
const BACKEND_SRC_IMAGES_DIR = join(process.cwd(), "..", "backend", "src", "images");

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
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
  const pathname = decodeURIComponent(url.pathname);
  const ext = extname(pathname).toLowerCase();
  if (!ext) return null;

  let filePath = join(CLIENT_DIR, pathname);
  if (!existsSync(filePath)) filePath = join(PUBLIC_DIR, pathname);

  // Fallback check for case-insensitive file matching (ONLY for files with an extension)
  if (!existsSync(filePath)) {
    const filename = pathname.replace(/^\//, "");
    const fallbacks = [
      join(CLIENT_DIR, filename.toLowerCase()),
      join(CLIENT_DIR, filename.charAt(0).toUpperCase() + filename.slice(1)),
      join(PUBLIC_DIR, filename.toLowerCase()),
      join(PUBLIC_DIR, filename.charAt(0).toUpperCase() + filename.slice(1)),
    ];
    for (const fb of fallbacks) {
      if (existsSync(fb)) {
        filePath = fb;
        break;
      }
    }
  }

  // Fallback check for uploaded images in backend directories
  if (!existsSync(filePath) && (pathname.startsWith("/upload_images/") || pathname.startsWith("/images/"))) {
    const filename = pathname.replace(/^\/(upload_images|images)\//, "");
    const candidatePaths = [
      join(UPLOAD_IMAGES_DIR, filename),
      join(BACKEND_UPLOAD_DIR, filename),
      join(BACKEND_SRC_IMAGES_DIR, filename),
      join(process.cwd(), "upload_images", filename),
    ];
    for (const cand of candidatePaths) {
      if (existsSync(cand)) {
        filePath = cand;
        break;
      }
    }
  }

  if (!existsSync(filePath)) return null;

  const fileExt = extname(filePath).toLowerCase() || ext;
  const contentType = MIME[fileExt] || "application/octet-stream";

  try {
    const body = readFileSync(filePath);
    return { body, contentType };
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
        nodeRes.writeHead(200, {
          "content-type": staticResponse.contentType,
          "content-length": staticResponse.body.length,
          "cache-control": "public, max-age=86400",
        });
        if (nodeReq.method === "HEAD") {
          nodeRes.end();
        } else {
          nodeRes.end(staticResponse.body);
        }
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
    if (!headers["cache-control"]) {
      headers["cache-control"] = "no-cache, no-store, must-revalidate";
    }
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
