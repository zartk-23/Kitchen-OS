import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** OAuth remains primary; memberships assign product roles per organization. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const waitlistEntries = mysqlTable("waitlist_entries", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  source: varchar("source", { length: 32 }).default("landing").notNull(),
  consentAt: timestamp("consentAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("waitlist_entries_email_unique").on(table.email)]);

/** Password hashes support local testing only. OAuth remains the production default. */
export const localCredentials = mysqlTable("local_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
}, table => [uniqueIndex("local_credentials_user_unique").on(table.userId), uniqueIndex("local_credentials_email_unique").on(table.email)]);

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("organizations_slug_unique").on(table.slug)]);

export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["owner", "manager", "chef", "staff", "analyst"]).default("owner").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("memberships_organization_user_unique").on(table.organizationId, table.userId), index("memberships_user_idx").on(table.userId)]);

export const restaurants = mysqlTable("restaurants", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  restaurantType: varchar("restaurantType", { length: 64 }).default("independent").notNull(),
  location: varchar("location", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("restaurants_organization_idx").on(table.organizationId)]);

export const inventoryItems = mysqlTable("inventory_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  restaurantId: int("restaurantId").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  minimumLevel: decimal("minimumLevel", { precision: 10, scale: 2 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("inventory_items_tenant_idx").on(table.organizationId, table.restaurantId)]);

export const menuItems = mysqlTable("menu_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  restaurantId: int("restaurantId").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }).notNull(),
  ingredientCost: decimal("ingredientCost", { precision: 10, scale: 2 }).notNull(),
  salesCount: int("salesCount").default(0).notNull(),
  classification: mysqlEnum("classification", ["star", "premium", "workhorse", "rework"]).default("workhorse").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("menu_items_tenant_idx").on(table.organizationId, table.restaurantId)]);

export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  restaurantId: int("restaurantId").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  yieldQuantity: decimal("yieldQuantity", { precision: 10, scale: 2 }).notNull(),
  yieldUnit: varchar("yieldUnit", { length: 24 }).notNull(),
  ingredientsJson: text("ingredientsJson").notNull(),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("recipes_tenant_idx").on(table.organizationId, table.restaurantId)]);

/** File bytes live in managed storage; this table only grants tenant-scoped recipe photo access. */
export const recipePhotos = mysqlTable("recipe_photos", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  recipeId: int("recipeId").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  contentType: varchar("contentType", { length: 32 }).notNull(),
  byteSize: int("byteSize").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("recipe_photos_recipe_unique").on(table.recipeId), index("recipe_photos_tenant_idx").on(table.organizationId)]);

export const purchaseDrafts = mysqlTable("purchase_drafts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  restaurantId: int("restaurantId").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  itemName: varchar("itemName", { length: 120 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 24 }).notNull(),
  supplier: varchar("supplier", { length: 120 }),
  rationale: text("rationale"),
  status: mysqlEnum("status", ["draft", "approved"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  approvedBy: int("approvedBy").references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("purchase_drafts_tenant_idx").on(table.organizationId, table.restaurantId, table.status)]);

export const swarmNotes = mysqlTable("swarm_notes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),
  lane: mysqlEnum("lane", ["observe", "prepare", "approve", "learn"]).default("observe").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("swarm_notes_organization_idx").on(table.organizationId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
