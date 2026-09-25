import type { Express, Request } from "express";
import multer from "multer";
import sharp from "sharp";
import { getAuthenticatedUser } from "./_core/context";
import * as db from "./db";
import { storagePut } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasSameOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === req.get("host"); } catch { return false; }
}

export function registerRecipePhotoRoutes(app: Express) {
  app.post("/api/recipes/:recipeId/photo", (req, res, next) => {
    upload.single("photo")(req, res, error => {
      if (error) return res.status(400).json({ error: "Upload a single image under 5 MB" });
      void handleRecipePhotoUpload(req, res, next);
    });
  });
}

async function handleRecipePhotoUpload(req: Request, res: Parameters<Express["post"]>[1] extends (...args: infer Args) => unknown ? Args[1] : never, _next: unknown) {
    try {
      if (!hasSameOrigin(req)) return res.status(403).json({ error: "Cross-origin upload rejected" });
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const recipeId = Number(req.params.recipeId);
      if (!Number.isSafeInteger(recipeId) || recipeId < 1) return res.status(400).json({ error: "Invalid recipe" });
      if (!req.file || !allowedMimeTypes.has(req.file.mimetype) || req.file.size === 0) return res.status(400).json({ error: "Upload a JPEG, PNG, or WebP image under 5 MB" });

      const workspace = await db.getOrganizationForUser(user.id);
      if (!workspace?.restaurant || !["owner", "manager", "chef"].includes(workspace.membership.role)) return res.status(403).json({ error: "Photo uploads are not permitted" });
      const recipe = await db.getRecipeForTenant({ id: recipeId, organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id });
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });

      // Decode first, limiting pixel count. Re-encoding removes metadata such as GPS EXIF.
      const image = sharp(req.file.buffer, { limitInputPixels: 25_000_000, failOn: "error" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) return res.status(400).json({ error: "The image could not be decoded" });
      const sanitized = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
      const uploadResult = await storagePut(`recipe-photos/${workspace.organization.id}/${recipe.id}/photo.jpg`, sanitized, "image/jpeg");
      await db.replaceRecipePhoto({ organizationId: workspace.organization.id, recipeId: recipe.id, storageKey: uploadResult.key, contentType: "image/jpeg", byteSize: sanitized.byteLength, createdBy: user.id });
      return res.status(201).json({ url: uploadResult.url });
    } catch (error) {
      console.error("Recipe photo upload failed", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "Unable to upload photo" });
    }
}
