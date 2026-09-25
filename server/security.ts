import type { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

/** Apply uniform transport and abuse protections before OAuth, tRPC, or static assets are mounted. */
export function applySecurityMiddleware(app: Express) {
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
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
                mediaSrc: ["'self'", "https://d8j0ntlcm91z4.cloudfront.net"],
                connectSrc: ["'self'"],
              },
            }
          : false,
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
    "/api/trpc",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again later." },
    }),
  );
}
