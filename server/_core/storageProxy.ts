import type { Express } from "express";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/{*key}", async (req, res) => {
    const rawKey = (req.params as { key?: string | string[] }).key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (!key || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/.test(key) || key.includes("..")) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error: ${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      const destination = new URL(url);
      if (destination.protocol !== "https:") {
        res.status(502).send("Invalid storage destination");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.set("Referrer-Policy", "no-referrer");
      res.redirect(307, destination.toString());
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
