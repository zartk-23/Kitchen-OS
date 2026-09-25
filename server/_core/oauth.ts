import { parse as parseCookie } from "cookie";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, decodeOAuthState, type OAuthState } from "@shared/const";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { createSessionToken, verifySessionToken } from "./session";

/**
 * OAuth sign-in routes for the app-session cookie flow. OAuth is only active
 * when every provider setting is present; otherwise these routes answer 501 and
 * the app keeps working with the local test login and public pages.
 */
export function registerOAuthRoutes(app: Express) {
  const isConfigured = () =>
    Boolean(
      ENV.oauth.clientId && ENV.oauth.clientSecret && ENV.oauth.authorizeUrl && ENV.oauth.tokenUrl,
    );

  app.get("/api/oauth/login", (req, res) => {
    if (!isConfigured()) {
      res.status(501).json({ error: "OAuth is not configured in this environment" });
      return;
    }

    const redirectUri =
      typeof req.query.redirect === "string" && req.query.redirect.startsWith("/")
        ? req.query.redirect
        : "/";
    const callbackUri =
      ENV.oauth.callbackUri || `${req.protocol}://${req.get("host")}/api/oauth/callback`;
    const state: OAuthState = { redirectUri, nonce: crypto.randomUUID() };
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie("__Host-oauth_state", state.nonce, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    });
    const authorizeUrl = new URL(ENV.oauth.authorizeUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", ENV.oauth.clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUri);
    authorizeUrl.searchParams.set("scope", ENV.oauth.scopes.join(" "));
    authorizeUrl.searchParams.set("state", encodeURIComponent(JSON.stringify(state)));
    res.redirect(authorizeUrl.toString());
  });

  app.get("/api/oauth/callback", async (req, res) => {
    try {
      if (!isConfigured()) {
        res.status(501).json({ error: "OAuth is not configured in this environment" });
        return;
      }

      const code = typeof req.query.code === "string" ? req.query.code : "";
      const rawState = typeof req.query.state === "string" ? req.query.state : "";
      const state: OAuthState = decodeOAuthState(rawState);
      const expectedNonce = parseCookie(req.headers.cookie ?? "")["__Host-oauth_state"];
      if (!code || !state.redirectUri || !expectedNonce || state.nonce !== expectedNonce) {
        res.status(403).json({ error: "Invalid OAuth state" });
        return;
      }

      const callbackUri =
        ENV.oauth.callbackUri || `${req.protocol}://${req.get("host")}/api/oauth/callback`;
      const tokenResponse = await fetch(ENV.oauth.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: ENV.oauth.clientId,
          client_secret: ENV.oauth.clientSecret,
          redirect_uri: callbackUri,
        }),
      });
      if (!tokenResponse.ok) {
        console.error(`[OAuth] token exchange failed: ${tokenResponse.status}`);
        res.status(502).json({ error: "Token exchange failed" });
        return;
      }
      const tokens = (await tokenResponse.json()) as { access_token?: string };
      if (!tokens.access_token) {
        res.status(502).json({ error: "Token exchange returned no access token" });
        return;
      }

      let profile: { sub?: string; email?: string; name?: string } = {};
      if (ENV.oauth.userInfoUrl) {
        const profileResponse = await fetch(ENV.oauth.userInfoUrl, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileResponse.ok) {
          profile = (await profileResponse.json()) as typeof profile;
        }
      }
      const openId = profile.sub || `oauth_${code.slice(0, 12)}`;

      await db.upsertUser({
        openId,
        name: profile.name ?? null,
        email: profile.email ?? null,
        loginMethod: "oauth",
        lastSignedIn: new Date(),
      });
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Could not load the user after sign-in" });
        return;
      }

      const token = await createSessionToken(user.id);
      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      const destination = state.redirectUri.startsWith("/") ? state.redirectUri : "/";
      res.redirect(destination);
    } catch (error) {
      console.error("[OAuth] callback failed:", error);
      res.status(500).json({ error: "OAuth sign-in failed" });
    }
  });

  app.get("/api/oauth/me", async (req: Request, res: Response) => {
    try {
      const token = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
      if (!token) {
        res.json({ authenticated: false, user: null });
        return;
      }
      const payload = await verifySessionToken(token);
      const userId = payload?.sub ? Number(payload.sub) : NaN;
      const user =
        Number.isSafeInteger(userId) && userId > 0 ? await db.getUserById(userId) : undefined;
      res.json({
        authenticated: Boolean(user),
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
      });
    } catch {
      res.json({ authenticated: false, user: null });
    }
  });
}
