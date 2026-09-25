import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  joinWaitlist: vi.fn(),
  getOrganizationForUser: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  getWorkspaceSnapshot: vi.fn(),
  addSwarmNote: vi.fn(),
  createLocalUser: vi.fn(),
  findLocalCredential: vi.fn(),
  markLocalCredentialUsed: vi.fn(),
  addRecipe: vi.fn(),
  addPurchaseDraft: vi.fn(),
  approvePurchaseDraft: vi.fn(),
  addInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  addMenuItem: vi.fn(),
}));

const localAuthMock = vi.hoisted(() => ({
  isLocalAuthEnabled: vi.fn(() => true),
  setLocalSession: vi.fn(),
  clearLocalSession: vi.fn(),
}));

const recipeParserMock = vi.hoisted(() => ({
  parseRecipeIngredients: vi.fn(),
}));

vi.mock("./db", () => dbMock);
vi.mock("./localAuth", () => localAuthMock);
vi.mock("./recipeParser", () => recipeParserMock);

import { appRouter } from "./routers";

const authenticatedUser = {
  id: 19,
  openId: "kitchen-user",
  name: "Kitchen Owner",
  email: "owner@example.test",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(user = authenticatedUser) {
  return {
    user,
    req: { ip: "198.51.100.7", protocol: "https", headers: {} },
    res: { clearCookie: vi.fn() },
  } as any;
}

describe("KitchenOS API boundaries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes and stores a validated waitlist email without exposing duplicate state", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.waitlist.join({ email: "  Owner@Example.TEST " })).resolves.toEqual({ accepted: true });
    expect(dbMock.joinWaitlist).toHaveBeenCalledWith("owner@example.test");
  });

  it("rejects malformed waitlist addresses before any database write", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.waitlist.join({ email: "not-an-email" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.joinWaitlist).not.toHaveBeenCalled();
  });

  it("rejects protected workspace reads when there is no verified session", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.workspace.current()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMock.getWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it("uses the verified caller identity for workspace reads instead of any client-provided tenant identifier", async () => {
    dbMock.getWorkspaceSnapshot.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 } });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.workspace.current()).resolves.toEqual({ organization: { id: 73 }, restaurant: { id: 9 } });
    expect(dbMock.getWorkspaceSnapshot).toHaveBeenCalledWith(authenticatedUser.id);
  });

  it("scopes a swarm note to the caller's resolved organization rather than client input", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "owner" } });
    const caller = appRouter.createCaller(createContext());

    await caller.swarm.addNote({ title: "Chicken signal", body: "Review delivery before dinner service.", lane: "prepare" });

    expect(dbMock.addSwarmNote).toHaveBeenCalledWith({
      organizationId: 73,
      authorId: authenticatedUser.id,
      title: "Chicken signal",
      body: "Review delivery before dinner service.",
      lane: "prepare",
    });
  });

  it("rejects a weak local password before it reaches persistence", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.auth.registerLocal({ name: "Kitchen Owner", email: "owner@example.test", password: "weak" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.createLocalUser).not.toHaveBeenCalled();
  });

  it("creates a local account only after strong validation and starts a signed fallback session", async () => {
    dbMock.createLocalUser.mockResolvedValue(authenticatedUser);
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.registerLocal({ name: "Kitchen Owner", email: "owner@example.test", password: "StrongPassphrase9" })).resolves.toEqual({ id: authenticatedUser.id, email: authenticatedUser.email });
    expect(dbMock.createLocalUser).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.test", name: "Kitchen Owner", passwordHash: expect.any(String) }));
    expect(localAuthMock.setLocalSession).toHaveBeenCalledWith(ctx.res, ctx.req, authenticatedUser);
  });

  it("rate-limits repeated local password attempts for the same client and email", async () => {
    dbMock.findLocalCredential.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext(null));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(caller.auth.loginLocal({ email: "brute-force@example.test", password: "wrong-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(caller.auth.loginLocal({ email: "brute-force@example.test", password: "wrong-password" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(dbMock.findLocalCredential).toHaveBeenCalledTimes(5);
  });

  it("calculates recipe cost on the server and scopes the write to the resolved workspace", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "chef" } });
    dbMock.addRecipe.mockResolvedValue(55);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.recipes.create({ name: "Tomato Sauce", yieldQuantity: 8, yieldUnit: "portions", sellingPrice: 11, ingredients: [{ name: "Tomatoes", quantity: 3, unit: "kg", unitCost: 2.5 }, { name: "Basil", quantity: 1, unit: "bunch", unitCost: 1.5 }] })).resolves.toEqual({ created: true, id: 55, estimatedCost: 9 });
    expect(dbMock.addRecipe).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 73, restaurantId: 9, createdBy: authenticatedUser.id, estimatedCost: "9.00" }));
  });

  it("returns a reviewed ingredient draft only through the protected parser route", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "chef" } });
    recipeParserMock.parseRecipeIngredients.mockResolvedValue({ ingredients: [{ name: "Tomatoes", quantity: 3, unit: "kg" }] });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.recipes.parseIngredients({ sourceText: "3 kg tomatoes, diced for sauce" })).resolves.toEqual({ ingredients: [{ name: "Tomatoes", quantity: 3, unit: "kg" }] });
    expect(recipeParserMock.parseRecipeIngredients).toHaveBeenCalledWith("3 kg tomatoes, diced for sauce");
  });

  it("does not allow a chef to approve a procurement draft", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "chef" } });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.procurement.approve({ id: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMock.approvePurchaseDraft).not.toHaveBeenCalled();
  });

  it("scopes an inventory write to the caller's resolved workspace and role", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "owner" } });
    dbMock.addInventoryItem.mockResolvedValue(101);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.addItem({ name: "  Chicken Thigh ", quantity: 18, unit: "kg", minimumLevel: 12 })).resolves.toEqual({ created: true, id: 101 });
    expect(dbMock.addInventoryItem).toHaveBeenCalledWith({ organizationId: 73, restaurantId: 9, name: "Chicken Thigh", quantity: "18.00", unit: "kg", minimumLevel: "12.00" });
  });

  it("rejects inventory writes from staff and analyst roles", async () => {
    for (const role of ["staff", "analyst"] as const) {
      dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role } });
      const caller = appRouter.createCaller(createContext());

      await expect(caller.inventory.addItem({ name: "Chicken Thigh", quantity: 18, unit: "kg", minimumLevel: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(dbMock.addInventoryItem).not.toHaveBeenCalled();
  });

  it("scopes a menu item write to the caller's resolved workspace and role", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "chef" } });
    dbMock.addMenuItem.mockResolvedValue(31);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.menu.addItem({ name: " Duck Ragu ", category: "Mains", sellingPrice: 24, ingredientCost: 7.5, salesCount: 60, classification: "star" })).resolves.toEqual({ created: true, id: 31 });
    expect(dbMock.addMenuItem).toHaveBeenCalledWith({ organizationId: 73, restaurantId: 9, name: "Duck Ragu", category: "Mains", sellingPrice: "24.00", ingredientCost: "7.50", salesCount: 60, classification: "star" });
  });

  it("rejects menu writes from roles that cannot manage the menu", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "analyst" } });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.menu.addItem({ name: "Duck Ragu", category: "Mains", sellingPrice: 24, ingredientCost: 7.5, salesCount: 60, classification: "star" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMock.addMenuItem).not.toHaveBeenCalled();
  });

  it("never lets an inventory update cross the caller's tenant boundary", async () => {
    dbMock.getOrganizationForUser.mockResolvedValue({ organization: { id: 73 }, restaurant: { id: 9 }, membership: { role: "manager" } });
    dbMock.updateInventoryItem.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.update({ id: 404, quantity: 0, minimumLevel: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.updateInventoryItem).toHaveBeenCalledWith({ id: 404, organizationId: 73, restaurantId: 9, quantity: "0.00", minimumLevel: "5.00" });
  });
});
