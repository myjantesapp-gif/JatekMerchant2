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
const { validateStaticBuild } = require("./build-check");

const STATIC_ROOT = path.resolve(
  process.env.STATIC_ROOT || path.join(__dirname, "..", "static-build"),
);
const APK_PATH = path.resolve(__dirname, "..", "builds", "jatek-preview.apk");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

// EAS Update project ID — used as fallback manifest source when static-build/ is absent.
// Keep this aligned with eas.json/app.json. Production does not inject the
// mobile build variables, so a stale fallback here makes the published QR code
// load a different Expo project than the current Android preview APK.
const EAS_PROJECT_ID =
  process.env.EXPO_PUBLIC_PROJECT_ID || "73e947fb-0a5a-4064-aafe-c856e231c9d4";
const EAS_CHANNEL = process.env.EXPO_CHANNEL_NAME || "preview";
const EAS_UPDATE_URL = `https://u.expo.dev/${EAS_PROJECT_ID}`;

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
  ".mp4": "video/mp4",
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

async function proxyEasManifest(platform, incomingHeaders, res) {
  try {
    const headers = {
      "expo-platform": platform,
      "expo-channel-name": incomingHeaders["expo-channel-name"] || EAS_CHANNEL,
      "accept": "multipart/mixed,application/expo+json,application/json",
    };
    // Forward runtime/SDK version headers if present
    for (const h of ["expo-runtime-version", "expo-sdk-version", "expo-updates-environment", "expo-expect-signature"]) {
      if (incomingHeaders[h]) headers[h] = incomingHeaders[h];
    }

    const easRes = await fetch(EAS_UPDATE_URL, { headers, signal: AbortSignal.timeout(10000) });

    if (!easRes.ok) {
      console.warn(`[serve] EAS manifest proxy failed: ${easRes.status}`);
      res.writeHead(easRes.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `EAS manifest error: ${easRes.status}` }));
      return;
    }

    // Forward all EAS response headers except transfer-encoding
    const resHeaders = { "cache-control": "no-store, no-cache, must-revalidate" };
    easRes.headers.forEach((v, k) => {
      if (k.toLowerCase() !== "transfer-encoding") resHeaders[k] = v;
    });
    const body = await easRes.arrayBuffer();
    res.writeHead(easRes.status, resHeaders);
    res.end(Buffer.from(body));
    console.info(`[serve] EAS manifest proxied for ${platform}`);
  } catch (err) {
    console.error("[serve] EAS manifest proxy error:", err.message);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "EAS proxy timeout" }));
  }
}

function serveManifest(platform, req, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  // Local static-build exists → serve it with URLs bound to the current
  // preview/deployment host. A committed build can be reused by a new
  // Replit deployment, so its old absolute Janeway host must never leak into
  // the manifest returned to Expo.
  if (fs.existsSync(manifestPath)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Static manifest is invalid" }));
      return;
    }
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
    const origin = `${protocol}://${host}`;
    const rewriteUrl = (value) => {
      if (typeof value !== "string" || !value) return value;
      try {
        const parsed = new URL(value, origin);
        return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return value;
      }
    };
    if (manifest.launchAsset?.url) manifest.launchAsset.url = rewriteUrl(manifest.launchAsset.url);
    if (Array.isArray(manifest.assets)) {
      manifest.assets = manifest.assets.map((asset) => asset?.url ? { ...asset, url: rewriteUrl(asset.url) } : asset);
    }
    const expoClient = manifest.extra?.expoClient;
    const expoGo = manifest.extra?.expoGo;
    if (expoClient?.hostUri) expoClient.hostUri = `${host}${basePath}/${platform}`;
    if (expoGo?.debuggerHost) expoGo.debuggerHost = `${host}${basePath}/${platform}`;
    res.writeHead(200, {
      "content-type": "application/json",
      "expo-protocol-version": "1",
      "expo-sfv-version": "0",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
    });
    res.end(JSON.stringify(manifest));
    return;
  }

  // No local build → proxy to EAS Update CDN
  console.info(`[serve] No local manifest for ${platform}, proxying to EAS Update...`);
  proxyEasManifest(platform, req.headers, res);
}

function serveStatus(res) {
  const result = validateStaticBuild({
    staticRoot: STATIC_ROOT,
    basePath,
  });
  const statusCode = result.ok ? 200 : 503;

  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(
    JSON.stringify({
      ok: result.ok,
      staticBuild: result.ok ? "ready" : "missing-or-invalid",
      errors: result.errors,
    }),
  );
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  // Include basePath so the QR deep-link points to /mobile/ not just /
  const expsUrl = basePath ? `${host}${basePath}` : host;
  const apkUrl = `${baseUrl}${basePath}/downloads/jatek-preview.apk`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APK_URL_PLACEHOLDER/g, apkUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveApkDownload(res) {
  if (!fs.existsSync(APK_PATH)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Android preview APK is not available");
    return;
  }

  const stat = fs.statSync(APK_PATH);
  res.writeHead(200, {
    "content-type": "application/vnd.android.package-archive",
    "content-length": stat.size,
    "content-disposition": 'attachment; filename="jatek-preview.apk"',
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  fs.createReadStream(APK_PATH).pipe(res);
}

function serveStaticFile(urlPath, res, req) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
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
  const content = fs.readFileSync(filePath);
  // Hashed Expo bundles (timestamped folders + content-hashed filenames)
  // can be cached aggressively. Everything else (HTML, manifests, fallback
  // assets) must revalidate on every load so a fresh deploy is picked up
  // immediately instead of being masked by CDN/proxy caches.
  const isHashedBundle = /\/_expo\/static\//.test(safePath);
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
  // Guard against missing or malformed Host header (e.g. health-check probes).
  // new URL() throws synchronously on invalid input, so we wrap it and return
  // a 400 rather than letting the exception propagate and crash the process.
  let url;
  try {
    const host = req.headers.host || "localhost";
    url = new URL(req.url || "/", `http://${host}`);
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Bad Request");
    return;
  }
  let pathname = url.pathname;

  // Artifact health checks are sent directly to the service while application
  // requests arrive through /mobile/. Keep this route outside base-path
  // stripping so both /status and /mobile/status report the same build state.
  if (pathname === "/status") {
    return serveStatus(res);
  }

  // Segment-aware basePath stripping: only strip when the URL starts with
  // basePath followed by "/" (or is exactly basePath). Avoids incorrectly
  // matching siblings like "/apple" when basePath is "/app".
  if (basePath && (pathname === basePath || pathname.startsWith(basePath + "/"))) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/status") {
    return serveStatus(res);
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, req, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  if (pathname === "/downloads/jatek-preview.apk") {
    return serveApkDownload(res);
  }

  serveStaticFile(pathname, res, req);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port} (base path: ${basePath || "/"})`);
});
