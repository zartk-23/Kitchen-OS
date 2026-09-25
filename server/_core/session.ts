import { SignJWT, jwtVerify } from "jose";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is not configured (needs at least 32 characters)");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs and verifies the app session cookie payload. Kept in its own module so
 * context creation has a single, testable entry point.
 */
export async function verifySessionToken(token: string): Promise<{ sub?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (payload && typeof payload.sub === "string") {
      return { sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSessionToken(userId: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(sessionSecret());
}
