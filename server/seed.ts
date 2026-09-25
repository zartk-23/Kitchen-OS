/**
 * Demo seed for KitchenOS.
 *
 * Populates the demo workspace (demo@restaurant.test / "Harbor Kitchen") with a
 * realistic restaurant dataset so the dashboard looks alive on first login.
 *
 * Idempotent: re-running only inserts rows that are missing, never duplicates.
 *
 * Usage: corepack pnpm db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import {
  inventoryItems,
  menuItems,
  purchaseDrafts,
  recipes,
  swarmNotes,
} from "../drizzle/schema";
import {
  createLocalUser,
  createWorkspaceForUser,
  findLocalCredential,
  getDb,
  getOrganizationForUser,
} from "./db";

export const DEMO_EMAIL = "demo@restaurant.test";
export const DEMO_PASSWORD = "StrongPassphrase9";
export const DEMO_ORG_NAME = "Harbor Kitchen Group";
export const DEMO_ORG_SLUG = "harbor-kitchen";
export const DEMO_RESTAURANT_NAME = "Harbor Kitchen";

type InventorySeed = {
  name: string;
  quantity: string;
  unit: string;
  minimumLevel: string;
  expiresAt: Date | null;
};

type MenuSeed = {
  name: string;
  category: string;
  sellingPrice: string;
  ingredientCost: string;
  salesCount: number;
  classification: "star" | "premium" | "workhorse" | "rework";
};

type PurchaseSeed = {
  itemName: string;
  quantity: string;
  unit: string;
  supplier: string;
  rationale: string;
  status: "draft" | "approved";
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const INVENTORY_SEED: InventorySeed[] = [
  { name: "Atlantic Salmon Fillet", quantity: "18.00", unit: "kg", minimumLevel: "10.00", expiresAt: daysFromNow(2) },
  { name: "Arborio Rice", quantity: "22.00", unit: "kg", minimumLevel: "8.00", expiresAt: daysFromNow(180) },
  { name: "Baby Spinach", quantity: "4.50", unit: "kg", minimumLevel: "6.00", expiresAt: daysFromNow(3) },
  { name: "Butter (Unsalted)", quantity: "9.00", unit: "kg", minimumLevel: "5.00", expiresAt: daysFromNow(30) },
  { name: "Cherry Tomatoes", quantity: "7.00", unit: "kg", minimumLevel: "5.00", expiresAt: daysFromNow(4) },
  { name: "Chicken Thigh (Boneless)", quantity: "25.00", unit: "kg", minimumLevel: "12.00", expiresAt: daysFromNow(5) },
  { name: "Extra Virgin Olive Oil", quantity: "12.00", unit: "L", minimumLevel: "6.00", expiresAt: daysFromNow(240) },
  { name: "Garlic", quantity: "3.20", unit: "kg", minimumLevel: "2.00", expiresAt: daysFromNow(20) },
  { name: "Heavy Cream 35%", quantity: "10.00", unit: "L", minimumLevel: "8.00", expiresAt: daysFromNow(9) },
  { name: "Parmesan (Parmigiano 24mo)", quantity: "6.50", unit: "kg", minimumLevel: "4.00", expiresAt: daysFromNow(90) },
  { name: "Parchment Paper", quantity: "6.00", unit: "roll", minimumLevel: "3.00", expiresAt: null },
  { name: "Prime Ribeye Steak", quantity: "12.00", unit: "kg", minimumLevel: "8.00", expiresAt: daysFromNow(6) },
  { name: "San Marzano Tomatoes (Canned)", quantity: "30.00", unit: "can", minimumLevel: "12.00", expiresAt: daysFromNow(400) },
  { name: "Sea Salt (Fine)", quantity: "8.00", unit: "kg", minimumLevel: "3.00", expiresAt: null },
  { name: "Sourdough Bread Loaf", quantity: "14.00", unit: "loaf", minimumLevel: "10.00", expiresAt: daysFromNow(1) },
  { name: "Sweet Potato", quantity: "2.00", unit: "kg", minimumLevel: "5.00", expiresAt: daysFromNow(14) },
];

const MENU_SEED: MenuSeed[] = [
  { name: "Pan-Seared Salmon", category: "Mains", sellingPrice: "28.00", ingredientCost: "9.10", salesCount: 214, classification: "star" },
  { name: "Herb-Roasted Chicken", category: "Mains", sellingPrice: "22.00", ingredientCost: "6.20", salesCount: 198, classification: "star" },
  { name: "Ribeye Steak Frites", category: "Mains", sellingPrice: "36.00", ingredientCost: "17.40", salesCount: 96, classification: "premium" },
  { name: "Mushroom Risotto", category: "Mains", sellingPrice: "19.00", ingredientCost: "4.30", salesCount: 121, classification: "workhorse" },
  { name: "Lobster Roll", category: "Starters", sellingPrice: "24.00", ingredientCost: "13.80", salesCount: 41, classification: "rework" },
  { name: "Burrata Caprese", category: "Starters", sellingPrice: "14.00", ingredientCost: "4.90", salesCount: 152, classification: "star" },
  { name: "Tomato Soup", category: "Starters", sellingPrice: "9.00", ingredientCost: "1.80", salesCount: 87, classification: "workhorse" },
  { name: "Tiramisu", category: "Desserts", sellingPrice: "11.00", ingredientCost: "2.60", salesCount: 133, classification: "star" },
  { name: "Affogato", category: "Desserts", sellingPrice: "8.00", ingredientCost: "1.40", salesCount: 45, classification: "workhorse" },
  { name: "Truffle Fries", category: "Sides", sellingPrice: "8.00", ingredientCost: "2.10", salesCount: 268, classification: "star" },
];

const PURCHASE_SEED: PurchaseSeed[] = [
  {
    itemName: "Baby Spinach",
    quantity: "6.00",
    unit: "kg",
    supplier: "Green Valley Produce",
    rationale: "Below minimum level (4.5kg on hand, min 6kg) — covers weekend salad service.",
    status: "draft",
  },
  {
    itemName: "Sweet Potato",
    quantity: "10.00",
    unit: "kg",
    supplier: "Green Valley Produce",
    rationale: "Running out in ~2 days at current burn rate; needed for the autumn side menu.",
    status: "draft",
  },
  {
    itemName: "Heavy Cream 35%",
    quantity: "12.00",
    unit: "L",
    supplier: "Coastal Dairy Co.",
    rationale: "Approaching minimum with two banquet reservations booked this week.",
    status: "draft",
  },
  {
    itemName: "Sourdough Bread Loaf",
    quantity: "20.00",
    unit: "loaf",
    supplier: "Harbor Bakehouse",
    rationale: "Daily staple, expires fast — standing daily order.",
    status: "approved",
  },
];

const RECIPE_SEED = {
  name: "Pan-Seared Salmon with Lemon Butter",
  yieldQuantity: "4.00",
  yieldUnit: "portions",
  ingredientsJson: JSON.stringify([
    { name: "Atlantic Salmon Fillet", quantity: "800", unit: "g", unitCost: "22.00", lineCost: "17.60" },
    { name: "Butter (Unsalted)", quantity: "120", unit: "g", unitCost: "9.00", lineCost: "1.08" },
    { name: "Lemon", quantity: "2", unit: "pcs", unitCost: "0.60", lineCost: "1.20" },
    { name: "Baby Spinach", quantity: "300", unit: "g", unitCost: "5.50", lineCost: "1.65" },
    { name: "Extra Virgin Olive Oil", quantity: "40", unit: "ml", unitCost: "8.00", lineCost: "0.32" },
    { name: "Sea Salt (Fine)", quantity: "6", unit: "g", unitCost: "1.20", lineCost: "0.01" },
  ]),
  estimatedCost: "21.86",
  sellingPrice: "112.00",
};

const SWARM_NOTE_SEED = [
  {
    title: "Weekend prep plan: double salmon mise",
    body: "Salmon sold out by 8:30pm Saturday. Prep 24 portions of lemon-butter mise ahead of Friday and Saturday dinner instead of 12.",
    lane: "prepare" as const,
  },
  {
    title: "Lobster roll under review",
    body: "41 covers this month at 42.5% food cost — worst margin on the menu. Testing a smaller brioche roll and 20g less lobster next week.",
    lane: "learn" as const,
  },
  {
    title: "Spinach order needs approval",
    body: "Drafted the Green Valley order; approve before Thursday delivery so salad station is covered for the weekend.",
    lane: "approve" as const,
  },
];

async function ensureDemoUser(): Promise<{ userId: number }> {
  const existing = await findLocalCredential(DEMO_EMAIL);
  if (existing) return { userId: existing.user.id };

  const created = await createLocalUser({
    name: "Demo Owner",
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
  });
  if (!created) throw new Error(`Could not create demo user ${DEMO_EMAIL}`);
  return { userId: created.id };
}

async function ensureDemoWorkspace(userId: number): Promise<{ organizationId: number; restaurantId: number }> {
  const existing = await getOrganizationForUser(userId);
  if (existing?.organization && existing.restaurant) {
    return { organizationId: existing.organization.id, restaurantId: existing.restaurant.id };
  }

  const created = await createWorkspaceForUser({
    userId,
    name: DEMO_ORG_NAME,
    slug: DEMO_ORG_SLUG,
    restaurantName: DEMO_RESTAURANT_NAME,
  });
  if (!created?.organization || !created.restaurant) throw new Error("Could not create demo workspace");
  return { organizationId: created.organization.id, restaurantId: created.restaurant.id };
}

async function seedTenantData(tenant: { organizationId: number; restaurantId: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const { organizationId, restaurantId, userId } = tenant;

  // Inventory: insert only names that do not exist yet for this tenant.
  const existingInventory = await db
    .select({ name: inventoryItems.name })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.organizationId, organizationId), eq(inventoryItems.restaurantId, restaurantId)));
  const knownInventory = new Set(existingInventory.map(row => row.name));
  const missingInventory = INVENTORY_SEED.filter(item => !knownInventory.has(item.name));
  if (missingInventory.length > 0) {
    await db.insert(inventoryItems).values(missingInventory.map(item => ({ ...item, organizationId, restaurantId })));
  }

  // Menu: insert only names that do not exist yet for this tenant.
  const existingMenu = await db
    .select({ name: menuItems.name })
    .from(menuItems)
    .where(and(eq(menuItems.organizationId, organizationId), eq(menuItems.restaurantId, restaurantId)));
  const knownMenu = new Set(existingMenu.map(row => row.name));
  const missingMenu = MENU_SEED.filter(item => !knownMenu.has(item.name));
  if (missingMenu.length > 0) {
    await db.insert(menuItems).values(missingMenu.map(item => ({ ...item, organizationId, restaurantId })));
  }

  // Purchase drafts: insert only itemName+status pairs that do not exist yet.
  const existingPurchases = await db
    .select({ itemName: purchaseDrafts.itemName, status: purchaseDrafts.status })
    .from(purchaseDrafts)
    .where(and(eq(purchaseDrafts.organizationId, organizationId), eq(purchaseDrafts.restaurantId, restaurantId)));
  const knownPurchases = new Set(existingPurchases.map(row => `${row.itemName}|${row.status}`));
  const missingPurchases = PURCHASE_SEED.filter(item => !knownPurchases.has(`${item.itemName}|${item.status}`));
  if (missingPurchases.length > 0) {
    await db
      .insert(purchaseDrafts)
      .values(missingPurchases.map(item => ({ ...item, organizationId, restaurantId, createdBy: userId })));
  }

  // Recipe: insert only if the tenant has no recipe with this name.
  const existingRecipes = await db
    .select({ name: recipes.name })
    .from(recipes)
    .where(and(eq(recipes.organizationId, organizationId), eq(recipes.restaurantId, restaurantId)));
  const knownRecipes = new Set(existingRecipes.map(row => row.name));
  if (!knownRecipes.has(RECIPE_SEED.name)) {
    await db.insert(recipes).values({
      ...RECIPE_SEED,
      organizationId,
      restaurantId,
      createdBy: userId,
    });
  }

  // Swarm notes: insert only identical titles.
  const existingNotes = await db
    .select({ title: swarmNotes.title })
    .from(swarmNotes)
    .where(eq(swarmNotes.organizationId, organizationId));
  const knownNotes = new Set(existingNotes.map(row => row.title));
  const missingNotes = SWARM_NOTE_SEED.filter(note => !knownNotes.has(note.title));
  if (missingNotes.length > 0) {
    await db.insert(swarmNotes).values(
      missingNotes.map(note => ({ ...note, organizationId, authorId: userId })),
    );
  }

  return {
    inventoryAdded: missingInventory.length,
    menuAdded: missingMenu.length,
    purchasesAdded: missingPurchases.length,
    recipeAdded: knownRecipes.has(RECIPE_SEED.name) ? 0 : 1,
    notesAdded: missingNotes.length,
  };
}

async function main() {
  console.log(`Seeding demo workspace for ${DEMO_EMAIL}...`);

  const { userId } = await ensureDemoUser();
  const tenant = await ensureDemoWorkspace(userId);
  const summary = await seedTenantData({ ...tenant, userId });

  console.log("Seed complete.");
  console.log(`  Inventory items added: ${summary.inventoryAdded}`);
  console.log(`  Menu items added:      ${summary.menuAdded}`);
  console.log(`  Purchase drafts added: ${summary.purchasesAdded}`);
  console.log(`  Recipes added:         ${summary.recipeAdded}`);
  console.log(`  Swarm notes added:     ${summary.notesAdded}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
