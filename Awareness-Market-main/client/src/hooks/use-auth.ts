import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { data: user, isLoading: isLoading, ...rest } = trpc.auth.me.useQuery();
  
  return {
    user: user || null,
    isAuthenticated: !!user,
    isLoading: isLoading || false,
    ...rest
  };
}
