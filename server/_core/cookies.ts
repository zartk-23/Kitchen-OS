import type { Request } from "express";

/**
 * Session cookie options shared by the OAuth app session and the local test
 * fallback. Cross-site OAuth callbacks need SameSite=None with Secure; over
 * plain http (local development) we fall back to SameSite=Lax so browsers
 * still accept the cookie.
 */
export function getSessionCookieOptions(req: Request) {
  const forwardedProto = (req.headers["x-forwarded-proto"] ?? "").toString();
  const isHttps = req.protocol === "https" || forwardedProto.includes("https");
  return {
    path: "/",
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? ("none" as const) : ("lax" as const),
  };
}
