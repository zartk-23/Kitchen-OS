import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import {
  type InsertUser,
  inventoryItems,
  localCredentials,
  memberships,
  menuItems,
  organizations,
  purchaseDrafts,
  recipePhotos,
  recipes,
  restaurants,
  swarmNotes,
  users,
  waitlistEntries,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;
export async function getDb() { if (!database && process.env.DATABASE_URL) database = drizzle(process.env.DATABASE_URL); return database; }
async function requireDb() { const db = await getDb(); if (!db) throw new Error("Database is unavailable"); return db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: user.lastSignedIn ?? new Date() };
  if (user.openId === ENV.ownerOpenId) values.role = "admin";
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn } });
}
export async function getUserByOpenId(openId: string) { const db = await requireDb(); return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }
export async function getUserById(id: number) { const db = await requireDb(); return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]; }
export async function joinWaitlist(email: string) { const db = await requireDb(); await db.insert(waitlistEntries).values({ email, source: "landing" }).onDuplicateKeyUpdate({ set: { email: sql`${waitlistEntries.email}` } }); }

function localOpenId(email: string) { return `local_${createHash("sha256").update(email).digest("hex").slice(0, 56)}`; }
export async function findLocalCredential(email: string) { const db = await requireDb(); return (await db.select({ credential: localCredentials, user: users }).from(localCredentials).innerJoin(users, eq(localCredentials.userId, users.id)).where(eq(localCredentials.email, email)).limit(1))[0]; }
export async function createLocalUser(input: { name: string; email: string; passwordHash: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const existing = await tx.select({ id: localCredentials.id }).from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
    if (existing[0]) return null;
    const userResult = await tx.insert(users).values({ openId: localOpenId(input.email), name: input.name, email: input.email, loginMethod: "local" });
    const userId = Number(userResult[0].insertId);
    await tx.insert(localCredentials).values({ userId, email: input.email, passwordHash: input.passwordHash });
    return (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0] ?? null;
  });
}
export async function markLocalCredentialUsed(id: number) { const db = await requireDb(); await db.update(localCredentials).set({ lastUsedAt: new Date() }).where(eq(localCredentials.id, id)); }

export async function getOrganizationForUser(userId: number) {
  const db = await requireDb();
  return (await db.select({ organization: organizations, membership: memberships, restaurant: restaurants }).from(memberships).innerJoin(organizations, eq(memberships.organizationId, organizations.id)).leftJoin(restaurants, eq(restaurants.organizationId, organizations.id)).where(eq(memberships.userId, userId)).orderBy(asc(organizations.createdAt)).limit(1))[0];
}
export async function createWorkspaceForUser(input: { userId: number; name: string; slug: string; restaurantName: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const existing = await tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.userId, input.userId)).limit(1);
    if (existing[0]) return getOrganizationForUser(input.userId);
    const orgResult = await tx.insert(organizations).values({ name: input.name, slug: input.slug });
    const organizationId = Number(orgResult[0].insertId);
    await tx.insert(memberships).values({ organizationId, userId: input.userId, role: "owner" });
    await tx.insert(restaurants).values({ organizationId, name: input.restaurantName });
    return getOrganizationForUser(input.userId);
  });
}
export async function getWorkspaceSnapshot(userId: number) {
  const workspace = await getOrganizationForUser(userId); if (!workspace?.restaurant) return null;
  const db = await requireDb(); const { organization, restaurant, membership } = workspace;
  const [inventory, menu, notes, recipeRows, photoRows, procurementRows] = await Promise.all([
    db.select().from(inventoryItems).where(and(eq(inventoryItems.organizationId, organization.id), eq(inventoryItems.restaurantId, restaurant.id))).orderBy(asc(inventoryItems.name)).limit(200),
    db.select().from(menuItems).where(and(eq(menuItems.organizationId, organization.id), eq(menuItems.restaurantId, restaurant.id))).orderBy(asc(menuItems.name)).limit(200),
    db.select().from(swarmNotes).where(eq(swarmNotes.organizationId, organization.id)).orderBy(asc(swarmNotes.createdAt)).limit(20),
    db.select().from(recipes).where(and(eq(recipes.organizationId, organization.id), eq(recipes.restaurantId, restaurant.id))).orderBy(asc(recipes.name)).limit(30),
    db.select().from(recipePhotos).where(eq(recipePhotos.organizationId, organization.id)).limit(30),
    db.select().from(purchaseDrafts).where(and(eq(purchaseDrafts.organizationId, organization.id), eq(purchaseDrafts.restaurantId, restaurant.id))).orderBy(asc(purchaseDrafts.createdAt)).limit(30),
  ]);
  const photosByRecipe = new Map(photoRows.map(photo => [photo.recipeId, photo]));
  const recipesWithPhotos = recipeRows.map(recipe => ({ ...recipe, photoUrl: photosByRecipe.get(recipe.id) ? `/manus-storage/${photosByRecipe.get(recipe.id)?.storageKey}` : null }));
  return { organization, restaurant, membership, inventory, menu, notes, recipes: recipesWithPhotos, procurement: procurementRows };
}
export async function addSwarmNote(input: { organizationId: number; authorId: number; title: string; body: string; lane: "observe" | "prepare" | "approve" | "learn" }) { const db = await requireDb(); await db.insert(swarmNotes).values(input); }
export async function addRecipe(input: { organizationId: number; restaurantId: number; createdBy: number; name: string; yieldQuantity: string; yieldUnit: string; ingredientsJson: string; estimatedCost: string; sellingPrice?: string | null }) { const db = await requireDb(); const result = await db.insert(recipes).values(input); return Number(result[0].insertId); }
export async function getRecipeForTenant(input: { id: number; organizationId: number; restaurantId: number }) { const db = await requireDb(); return (await db.select().from(recipes).where(and(eq(recipes.id, input.id), eq(recipes.organizationId, input.organizationId), eq(recipes.restaurantId, input.restaurantId))).limit(1))[0]; }
export async function replaceRecipePhoto(input: { organizationId: number; recipeId: number; storageKey: string; contentType: string; byteSize: number; createdBy: number }) {
  const db = await requireDb();
  await db.insert(recipePhotos).values(input).onDuplicateKeyUpdate({ set: { storageKey: input.storageKey, contentType: input.contentType, byteSize: input.byteSize, createdBy: input.createdBy } });
}
export async function addPurchaseDraft(input: { organizationId: number; restaurantId: number; createdBy: number; itemName: string; quantity: string; unit: string; supplier?: string | null; rationale?: string | null }) { const db = await requireDb(); await db.insert(purchaseDrafts).values(input); }
export async function approvePurchaseDraft(input: { id: number; organizationId: number; restaurantId: number; approvedBy: number }) { const db = await requireDb(); const result = await db.update(purchaseDrafts).set({ status: "approved", approvedBy: input.approvedBy, approvedAt: new Date() }).where(and(eq(purchaseDrafts.id, input.id), eq(purchaseDrafts.organizationId, input.organizationId), eq(purchaseDrafts.restaurantId, input.restaurantId), eq(purchaseDrafts.status, "draft"))); return result[0].affectedRows === 1; }
export async function addInventoryItem(input: { organizationId: number; restaurantId: number; name: string; quantity: string; unit: string; minimumLevel: string }) { const db = await requireDb(); const result = await db.insert(inventoryItems).values(input); return Number(result[0].insertId); }
export async function updateInventoryItem(input: { id: number; organizationId: number; restaurantId: number; quantity: string; minimumLevel: string }) { const db = await requireDb(); const result = await db.update(inventoryItems).set({ quantity: input.quantity, minimumLevel: input.minimumLevel }).where(and(eq(inventoryItems.id, input.id), eq(inventoryItems.organizationId, input.organizationId), eq(inventoryItems.restaurantId, input.restaurantId))); return result[0].affectedRows === 1; }
export async function addMenuItem(input: { organizationId: number; restaurantId: number; name: string; category: string; sellingPrice: string; ingredientCost: string; salesCount: number; classification: "star" | "premium" | "workhorse" | "rework" }) { const db = await requireDb(); const result = await db.insert(menuItems).values(input); return Number(result[0].insertId); }
