/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const STATIC_ROOT_REAL = fs.existsSync(STATIC_ROOT)
  ? fs.realpathSync(STATIC_ROOT)
  : STATIC_ROOT;
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const ALLOWED_MANIFEST_PLATFORMS = new Set(["ios", "android"]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function resolvePublicPath(requestPath) {
  if (typeof requestPath !== "string" || requestPath.length > 4096 || requestPath.includes("\0")) {
    return null;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  if (decodedPath.includes("\\")) return null;
  const relativePath = decodedPath.replace(/^\/+/, "");
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) return null;

  const candidate = path.resolve(STATIC_ROOT, relativePath);
  const relativeToRoot = path.relative(STATIC_ROOT, candidate);
  if (
    !relativeToRoot ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  if (fs.existsSync(candidate)) {
    const realCandidate = fs.realpathSync(candidate);
    const realRelativeToRoot = path.relative(STATIC_ROOT_REAL, realCandidate);
    if (
      !realRelativeToRoot ||
      realRelativeToRoot === ".." ||
      realRelativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelativeToRoot)
    ) {
      return null;
    }
  }

  return candidate;
}

function serveManifest(platform, res) {
  if (!ALLOWED_MANIFEST_PLATFORMS.has(platform)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unsupported platform" }));
    return;
  }
  const manifestPath = resolvePublicPath(`${platform}/manifest.json`);
  if (!manifestPath) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return;
  }

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  // nosemgrep: javascript.express.file.fs-express.fs-express — manifestPath is an allowlisted platform path confined by resolvePublicPath.
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
    "cache-control": "no-store, no-cache, must-revalidate",
    "pragma": "no-cache",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticFile(urlPath, res, req) {
  const filePath = resolvePublicPath(urlPath);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Unknown path → redirect users to the landing page rather than showing a
    // bare "Not Found" string. The landing page explains how to open the app
    // in Expo Go, which is what visitors are looking for here.
    const acceptsHtml = (req?.headers?.accept ?? "").includes("text/html");
    if (acceptsHtml) {
      const target = (basePath || "") + "/";
      res.writeHead(302, { location: target });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  // nosemgrep: javascript.express.file.fs-express.fs-express — filePath is confined by resolvePublicPath before this read.
  const content = fs.readFileSync(filePath);
  // Hashed Expo bundles (timestamped folders + content-hashed filenames)
  // can be cached aggressively. Everything else (HTML, manifests, fallback
  // assets) must revalidate on every load so a fresh deploy is picked up
  // immediately instead of being masked by CDN/proxy caches.
  const relativePath = path.relative(STATIC_ROOT, filePath).split(path.sep).join("/");
  const isHashedBundle = relativePath.startsWith("_expo/static/");
  const cacheControl = isHashedBundle
    ? "public, max-age=31536000, immutable"
    : "no-store, no-cache, must-revalidate";
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": cacheControl,
  });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Segment-aware basePath stripping: only strip when the URL starts with
  // basePath followed by "/" (or is exactly basePath). Avoids incorrectly
  // matching siblings like "/apple" when basePath is "/app".
  if (basePath && (pathname === basePath || pathname.startsWith(basePath + "/"))) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, res, req);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
