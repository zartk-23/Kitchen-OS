import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserById } from "../db";
import { getLocalSessionUserId } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    const localUserId = await getLocalSessionUserId(req);
    user = localUserId ? await getUserById(localUserId) ?? null : null;
  }

  return user;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await getAuthenticatedUser(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
