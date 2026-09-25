import { createSecretKey } from "node:crypto";
import type { Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import type { User } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";

export const LOCAL_SESSION_COOKIE = "kitchenos_local_session";
const ISSUER = "kitchenos-local-auth";
const AUDIENCE = "kitchenos-local-session";

export function isLocalAuthEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_AUTH === "true";
}

function sessionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Local authentication session secret is not configured");
  return createSecretKey(Buffer.from(secret, "utf8"));
}

export async function setLocalSession(res: Response, req: Request, user: User) {
  const token = await new SignJWT({ loginMethod: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LOCAL_SESSION_COOKIE, token, { ...cookieOptions, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 });
}

export function clearLocalSession(res: Response, req: Request) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(LOCAL_SESSION_COOKIE, { ...cookieOptions, sameSite: "lax", maxAge: -1 });
}

export async function getLocalSessionUserId(req: Request) {
  if (!isLocalAuthEnabled()) return null;
  const token = parse(req.headers.cookie || "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, sessionKey(), { issuer: ISSUER, audience: AUDIENCE });
    const userId = Number(verified.payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
