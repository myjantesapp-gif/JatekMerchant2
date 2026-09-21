import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import http from "http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachAuth } from "./middlewares/auth";

const app: Express = express();
const mobileStaticPort = Number(process.env["MOBILE_STATIC_PORT"] ?? "25896");
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const bannerAssetsDir = path.resolve(currentDir, "../public/banners");
const splashAssetsDir = path.resolve(currentDir, "../public/splash");

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(compression());
if (existsSync(bannerAssetsDir)) {
  app.use("/banners", express.static(bannerAssetsDir, { maxAge: "1d" }));
  app.use("/api/banners", express.static(bannerAssetsDir, { maxAge: "1d" }));
}
if (existsSync(splashAssetsDir)) {
  app.use("/api/splash", express.static(splashAssetsDir, { maxAge: "1d", immutable: true }));
}

// In production, restrict CORS to known origins. Set ALLOWED_ORIGINS as a
// comma-separated list (e.g. "https://app.example.com,https://admin.example.com").
// We also auto-allow Replit's hosted preview/deploy subdomains and same-origin
// (no Origin header — typical for native mobile apps that just send a host).
const isProd = process.env["NODE_ENV"] === "production";
const allowedOrigins: string[] = [
  process.env["ALLOWED_ORIGINS"] ?? "",
  process.env["DRIVER_APP_ORIGINS"] ?? "",
  process.env["DRIVER_APP_ORIGIN"] ?? "",
].join(",")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Replit-hosted apps (dev previews, Expo Go on Replit) use *.replit.dev /
// *.replit.app subdomains. We allow these only when the server itself is
// running inside a Replit deployment (REPLIT_DEPLOYMENT env present), so we
// are not trusting arbitrary external tenants — just our own deployment's peers.
const isReplitDeployment = !!(
  process.env["REPLIT_DEPLOYMENT"] ||
  process.env["REPLIT_DEPLOYMENT_ID"] ||
  process.env["REPLIT_DEPLOYMENT_DOMAIN"]
);

const corsOriginCheck: cors.CorsOptions["origin"] = (origin, callback) => {
  // Same-origin / native mobile / curl — no Origin header at all.
  if (!origin) return callback(null, true);
  // Dev: open CORS to make local browsers + multiple ports painless.
  if (!isProd) return callback(null, true);
  // Explicit allow-list match.
  if (allowedOrigins.includes(origin)) return callback(null, true);
  try {
    const host = new URL(origin).hostname;
    // Auto-allow the production custom domain (configured via EXPO_PUBLIC_DOMAIN).
    const customHost = (process.env["EXPO_PUBLIC_DOMAIN"] ?? "").trim();
    if (customHost && host === customHost) return callback(null, true);
    // Allow Replit-hosted preview/Expo-Go origins when running inside a Replit
    // deployment. Scoped to our own deployment environment, not all tenants.
    if (isReplitDeployment && (host.endsWith(".replit.dev") || host.endsWith(".replit.app"))) {
      return callback(null, true);
    }
  } catch {
    // Fall through to reject below.
  }
  logger.warn({ origin }, "CORS: rejected origin");
  return callback(new Error(`CORS: origin not allowed: ${origin}`));
};

app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Client", "X-Jatek-Media-Kind"],
    maxAge: 86400,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── Android App Links (Digital Asset Links) ─────────────────────────────────
// Required for Android deep-linking (App Links). Must be served at exactly this
// path on the domain referenced in the app's intent-filter.
//
// com.jatek      → SHA-256 is the Google Play App Signing key (Play re-signs the APK)
// ma.jatek.app   → SHA-256 is the EAS upload/signing key (used in dev / direct installs)
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.jatek",
        sha256_cert_fingerprints: [
          // Google Play App Signing key (Play-distributed builds)
          "79:14:77:99:45:24:99:BB:CE:80:94:D8:84:70:2E:A7:A4:84:4B:BA:A0:E0:96:75:DC:B3:73:4E:4B:78:DE:F9",
        ],
      },
    },
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "ma.jatek.app",
        sha256_cert_fingerprints: [
          // EAS keystore signing key (production EAS builds)
          "A3:54:57:FF:61:1F:07:04:43:52:A7:D5:30:D1:11:0B:12:5B:6A:88:E6:18:EB:33:CA:83:F7:A6:42:FC:C1:14",
        ],
      },
    },
  ]);
});

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/healthz" || req.path.startsWith("/events"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use((req, res, next) => {
  const isMediaUpload = req.originalUrl.split("?")[0].startsWith("/api/storage/uploads/");
  const timeout = isMediaUpload ? 120_000 : 30_000;
  req.setTimeout(timeout);
  res.setTimeout(timeout);
  next();
});

app.use("/api", attachAuth);
app.use("/api", router);

function proxyMobileStatic(req: Request, res: Response): void {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: mobileStaticPort,
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
    },
    (upstreamResponse) => {
      res.status(upstreamResponse.statusCode ?? 502);
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (value !== undefined && name !== "connection" && name !== "transfer-encoding") {
          res.setHeader(name, value);
        }
      }
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    logger.error({ err: error, url: req.originalUrl }, "Mobile static proxy failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Mobile preview is unavailable" });
    } else {
      res.end();
    }
  });

  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
}

// ─── Production static file serving ──────────────────────────────────────────
// In production the API server serves:
//   /        → jatek-landing (built to artifacts/jatek-landing/dist/public)
//   /admin/* → backend-dashboard (built to artifacts/backend-dashboard/dist/public)
if (process.env.NODE_ENV === "production") {
  const landingDir = path.resolve(__dirname, "../../jatek-landing/dist/public");
  const dashboardDir = path.resolve(__dirname, "../../backend-dashboard/dist/public");

  // The deployment exposes the API port publicly. Route mobile Expo requests
  // through it to the dedicated static server so /mobile/ manifests, bundles,
  // and assets use the same public deployment domain as the rest of the app.
  app.use("/mobile", proxyMobileStatic);

  // Landing page at root
  if (existsSync(landingDir)) {
    app.use("/", express.static(landingDir, { index: "index.html" }));
    logger.info("Serving jatek-landing static files from " + landingDir);
  } else {
    logger.warn("jatek-landing/dist/public not found — run pnpm build first");
  }

  // Admin dashboard at /admin
  if (existsSync(dashboardDir)) {
    app.use("/admin", express.static(dashboardDir, { index: "index.html" }));
    // SPA fallback for /admin/* routes
    app.get("/admin/*splat", (_req, res) => {
      res.sendFile(path.join(dashboardDir, "index.html"));
    });
    logger.info("Serving backend-dashboard static files from " + dashboardDir);
  } else {
    logger.warn("backend-dashboard/dist/public not found — run pnpm build first");
  }

  // SPA fallback for the landing page at root (after /admin and /api routes)
  app.get("/*splat", (req, res): void => {
    // API and admin paths should not be served by the landing page SPA
    if (req.path.startsWith("/api") || req.path.startsWith("/admin")) {
      res.status(404).json({ error: "Not found", path: req.path }); return;
    }
    res.sendFile(path.join(landingDir, "index.html"));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.path });
  });
}

app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  if (res.headersSent) return;
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

export default app;
