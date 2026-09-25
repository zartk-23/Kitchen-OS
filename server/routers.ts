import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { clearLocalSession, isLocalAuthEnabled, setLocalSession } from "./localAuth";
import { parseRecipeIngredients } from "./recipeParser";

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const workspaceSchema = z.object({ organizationName: z.string().trim().min(2).max(120), restaurantName: z.string().trim().min(2).max(120) });
const swarmNoteSchema = z.object({ title: z.string().trim().min(2).max(140), body: z.string().trim().min(2).max(2_000), lane: z.enum(["observe", "prepare", "approve", "learn"]) });
const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128).refine(value => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), "Use upper-case, lower-case, and a number.");
const localRegistrationSchema = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema });
const localLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const ingredientSchema = z.object({ name: z.string().trim().min(2).max(120), quantity: z.number().positive().max(100_000), unit: z.string().trim().min(1).max(24), unitCost: z.number().min(0).max(100_000) });
const recipeSchema = z.object({ name: z.string().trim().min(2).max(120), yieldQuantity: z.number().positive().max(100_000), yieldUnit: z.string().trim().min(1).max(24), sellingPrice: z.number().positive().max(100_000).optional(), ingredients: z.array(ingredientSchema).min(1).max(30) });
const purchaseDraftSchema = z.object({ itemName: z.string().trim().min(2).max(120), quantity: z.number().positive().max(100_000), unit: z.string().trim().min(1).max(24), supplier: z.string().trim().max(120).optional(), rationale: z.string().trim().max(1_000).optional() });
const inventoryItemSchema = z.object({ name: z.string().trim().min(2).max(120), quantity: z.number().min(0).max(100_000), unit: z.string().trim().min(1).max(16), minimumLevel: z.number().min(0).max(100_000) });
const inventoryUpdateSchema = z.object({ id: z.number().int().positive(), quantity: z.number().min(0).max(100_000), minimumLevel: z.number().min(0).max(100_000) });
const menuItemSchema = z.object({ name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(64), sellingPrice: z.number().positive().max(100_000), ingredientCost: z.number().min(0).max(100_000), salesCount: z.number().int().min(0).max(1_000_000), classification: z.enum(["star", "premium", "workhorse", "rework"]) });

const waitlistWindows = new Map<string, { count: number; resetAt: number }>();
const localAuthWindows = new Map<string, { count: number; resetAt: number }>();
const parserWindows = new Map<string, { count: number; resetAt: number }>();
function enforceWaitlistThrottle(key: string) {
  const now = Date.now(); const current = waitlistWindows.get(key);
  if (!current || current.resetAt < now) { waitlistWindows.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return; }
  if (current.count >= 5) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please try again later." });
  current.count += 1;
}
function enforceLocalAuthThrottle(key: string) {
  const now = Date.now(); const current = localAuthWindows.get(key);
  if (!current || current.resetAt < now) { localAuthWindows.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return; }
  if (current.count >= 5) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait before trying again." });
  current.count += 1;
}
function enforceParserThrottle(key: string) {
  const now = Date.now(); const current = parserWindows.get(key);
  if (!current || current.resetAt < now) { parserWindows.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return; }
  if (current.count >= 10) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Ingredient parsing is temporarily limited. Please try again shortly." });
  current.count += 1;
}
function slugify(value: string) { const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72); return `${slug || "kitchen"}-${Math.random().toString(36).slice(2, 8)}`; }
async function workspaceFor(ctx: { user: { id: number } }) {
  const workspace = await db.getOrganizationForUser(ctx.user.id);
  if (!workspace?.restaurant) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create a workspace first." });
  return { ...workspace, restaurant: workspace.restaurant };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    localAvailable: publicProcedure.query(() => ({ enabled: isLocalAuthEnabled() })),
    registerLocal: publicProcedure.input(localRegistrationSchema).mutation(async ({ ctx, input }) => {
      if (!isLocalAuthEnabled()) throw new TRPCError({ code: "NOT_FOUND" });
      enforceLocalAuthThrottle(`${ctx.req.ip}:register:${input.email}`);
      const user = await db.createLocalUser({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12) });
      if (!user) throw new TRPCError({ code: "CONFLICT", message: "Unable to create an account with those details." });
      await setLocalSession(ctx.res, ctx.req, user);
      return { id: user.id, email: user.email };
    }),
    loginLocal: publicProcedure.input(localLoginSchema).mutation(async ({ ctx, input }) => {
      if (!isLocalAuthEnabled()) throw new TRPCError({ code: "NOT_FOUND" });
      enforceLocalAuthThrottle(`${ctx.req.ip}:login:${input.email}`);
      const record = await db.findLocalCredential(input.email);
      const valid = record ? await bcrypt.compare(input.password, record.credential.passwordHash) : false;
      if (!record || !valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      await db.markLocalCredentialUsed(record.credential.id);
      await setLocalSession(ctx.res, ctx.req, record.user);
      return { id: record.user.id, email: record.user.email };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearLocalSession(ctx.res, ctx.req);
      return { success: true } as const;
    }),
  }),
  waitlist: router({
    join: publicProcedure.input(z.object({ email: emailSchema })).output(z.object({ accepted: z.literal(true) })).mutation(async ({ input, ctx }) => { enforceWaitlistThrottle(`${ctx.req.ip}:${input.email}`); await db.joinWaitlist(input.email); return { accepted: true } as const; }),
  }),
  workspace: router({
    current: protectedProcedure.query(({ ctx }) => db.getWorkspaceSnapshot(ctx.user.id)),
    create: protectedProcedure.input(workspaceSchema).mutation(async ({ ctx, input }) => db.createWorkspaceForUser({ userId: ctx.user.id, name: input.organizationName, restaurantName: input.restaurantName, slug: slugify(input.organizationName) })),
  }),
  swarm: router({
    addNote: protectedProcedure.input(swarmNoteSchema).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx); await db.addSwarmNote({ organizationId: workspace.organization.id, authorId: ctx.user.id, ...input }); return { created: true } as const; }),
  }),
  recipes: router({
    parseIngredients: protectedProcedure.input(z.object({ sourceText: z.string().trim().min(10).max(5_000) })).mutation(async ({ ctx, input }) => {
      await workspaceFor(ctx);
      enforceParserThrottle(String(ctx.user.id));
      try { return await parseRecipeIngredients(input.sourceText); } catch { throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not parse those ingredients. Please edit them manually." }); }
    }),
    create: protectedProcedure.input(recipeSchema).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager", "chef"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const estimatedCost = input.ingredients.reduce((total, ingredient) => total + ingredient.quantity * ingredient.unitCost, 0);
      const id = await db.addRecipe({ organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, createdBy: ctx.user.id, name: input.name, yieldQuantity: input.yieldQuantity.toFixed(2), yieldUnit: input.yieldUnit, ingredientsJson: JSON.stringify(input.ingredients), estimatedCost: estimatedCost.toFixed(2), sellingPrice: input.sellingPrice?.toFixed(2) });
      return { created: true, id, estimatedCost: Number(estimatedCost.toFixed(2)) } as const;
    }),
  }),
  procurement: router({
    createDraft: protectedProcedure.input(purchaseDraftSchema).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager", "chef"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await db.addPurchaseDraft({ organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, createdBy: ctx.user.id, itemName: input.itemName, quantity: input.quantity.toFixed(2), unit: input.unit, supplier: input.supplier || null, rationale: input.rationale || null });
      return { created: true } as const;
    }),
    approve: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner or manager can approve a purchase." });
      const approved = await db.approvePurchaseDraft({ id: input.id, organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, approvedBy: ctx.user.id });
      if (!approved) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found or already approved." });
      return { approved: true } as const;
    }),
  }),
  inventory: router({
    addItem: protectedProcedure.input(inventoryItemSchema).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager", "chef"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner, manager, or chef can add inventory." });
      const id = await db.addInventoryItem({ organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, name: input.name, quantity: input.quantity.toFixed(2), unit: input.unit, minimumLevel: input.minimumLevel.toFixed(2) });
      return { created: true, id } as const;
    }),
    update: protectedProcedure.input(inventoryUpdateSchema).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager", "chef"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner, manager, or chef can adjust inventory." });
      const updated = await db.updateInventoryItem({ id: input.id, organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, quantity: input.quantity.toFixed(2), minimumLevel: input.minimumLevel.toFixed(2) });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found." });
      return { updated: true } as const;
    }),
  }),
  menu: router({
    addItem: protectedProcedure.input(menuItemSchema).mutation(async ({ ctx, input }) => {
      const workspace = await workspaceFor(ctx);
      if (!["owner", "manager", "chef"].includes(workspace.membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner, manager, or chef can add menu items." });
      const id = await db.addMenuItem({ organizationId: workspace.organization.id, restaurantId: workspace.restaurant.id, name: input.name, category: input.category, sellingPrice: input.sellingPrice.toFixed(2), ingredientCost: input.ingredientCost.toFixed(2), salesCount: input.salesCount, classification: input.classification });
      return { created: true, id } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
