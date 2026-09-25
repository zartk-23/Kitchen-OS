import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "test-fixtures");

describe("production response safeguards", () => {
  it("sets restrictive security headers without exposing Express details", async () => {
    const response = await request(createApp(fixturePath, 10)).get("/");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("serves a safe SPA fallback for unrecognised paths", async () => {
    const response = await request(createApp(fixturePath, 10)).get("/untrusted/path?next=https://example.test");

    expect(response.status).toBe(200);
    expect(response.text).toContain("KitchenOS fixture");
    expect(response.text).not.toContain("Error:");
  });

  it("rate-limits repeated requests from the same client", async () => {
    const app = createApp(fixturePath, 2);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    const blocked = await request(app).get("/");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests. Please try again later." });
  });
});
