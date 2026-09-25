import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HERO_VIDEO_ORIGIN = "https://d8j0ntlcm91z4.cloudfront.net";

export function getStaticPath() {
  return process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public")
    : path.resolve(__dirname, "..", "dist", "public");
}

/**
 * KitchenOS is a static public site today. This application factory keeps transport-level
 * safeguards in one place so future API routes must opt into deterministic authorization,
 * validation, and tenant isolation rather than inheriting permissive defaults.
 */
export function createApp(staticPath = getStaticPath(), requestLimit = 600): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", HERO_VIDEO_ORIGIN],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    next();
  });

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: requestLimit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again later." },
    }),
  );

  app.use(
    express.static(staticPath, {
      fallthrough: true,
      etag: true,
      index: false,
      setHeaders(res, filePath) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader(
          "Cache-Control",
          filePath.includes(`${path.sep}assets${path.sep}`)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );

  // Client-side routing fallback. No user-controlled path is resolved on disk.
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  return app;
}

export async function startServer() {
  const app = createApp();
  const server = createServer(app);
  const configuredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const port = Number.isSafeInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;

  server.listen(port, () => {
    console.log(`KitchenOS server listening on port ${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch(() => {
    console.error("Unable to start server");
    process.exitCode = 1;
  });
}
