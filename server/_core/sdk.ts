import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { getUserById } from "../db";
import type { User } from "../../drizzle/schema";
import { verifySessionToken } from "./session";

/**
 * Minimal stand-in for the Manus platform SDK. It authenticates requests from
 * the app session cookie (set by /api/oauth/callback) so the project runs
 * standalone; local test sessions are handled separately in localAuth.ts.
 */
export const sdk = {
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookie(req.headers.cookie ?? "");
    const token = cookies[COOKIE_NAME];
    if (!token) throw new Error("No session cookie");

    const payload = await verifySessionToken(token);
    const userId = payload?.sub ? Number(payload.sub) : NaN;
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new Error("Invalid session token");
    }

    const user = await getUserById(userId);
    if (!user) throw new Error("Session user no longer exists");
    return user;
  },
};
