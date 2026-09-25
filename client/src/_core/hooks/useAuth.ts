import { trpc } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * Provides the authenticated user (or null) plus loading state and a logout
 * mutation. Backed by the auth.me tRPC procedure.
 */
export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.assign("/");
    },
  });

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isPending,
    isAuthenticated: Boolean(meQuery.data),
    logout: () => logoutMutation.mutate(),
    refetchUser: meQuery.refetch,
  };
}
