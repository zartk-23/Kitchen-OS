import { publicProcedure, router } from "./trpc";

/**
 * Small system router used by the main appRouter for health checks.
 */
export const systemRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    time: new Date().toISOString(),
  })),
});
