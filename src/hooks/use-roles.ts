import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myRoles } from "@/lib/expenses.functions";
import { useAuth } from "@/hooks/use-auth";

const ROLES_CACHE_KEY = "ei-roles-cache-v1";

function readCachedRoles(userId: string | undefined): string[] | undefined {
  if (!userId || typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(ROLES_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { userId: string; roles: string[] };
    return parsed.userId === userId ? parsed.roles : undefined;
  } catch { return undefined; }
}

export function useRoles() {
  const { user, ready } = useAuth();
  const fn = useServerFn(myRoles);
  const cached = readCachedRoles(user?.id);
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: async () => {
      const r = await fn();
      if (user?.id && typeof window !== "undefined") {
        try { localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify({ userId: user.id, roles: r })); } catch {/* ignore */}
      }
      return r;
    },
    staleTime: 5 * 60_000,
    enabled: ready && !!user,
    retry: false,
    initialData: cached,
  });
  return {
    roles: data,
    // If we have cached roles for this user, treat as "not loading" — render
    // role-gated UI immediately instead of flashing a skeleton.
    isLoading: cached ? false : isLoading,
    isManager: data.includes("manager") || data.includes("admin") || data.includes("finance"),
    isFinance: data.includes("finance") || data.includes("admin"),
    isAdmin: data.includes("admin"),
  };
}
