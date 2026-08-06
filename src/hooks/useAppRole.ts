import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "elu" | "none";

/** Détermine si l'utilisateur connecté est l'administrateur ou un élu. */
export function useAppRole() {
  const query = useQuery({
    queryKey: ["app-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return "none";

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (roles?.some((r) => r.role === "admin")) return "admin";

      const { data: elu } = await supabase
        .from("elus")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      return elu ? "elu" : "none";
    },
  });

  return {
    role: query.data ?? "none",
    isAdmin: query.data === "admin",
    isElu: query.data === "elu",
    isLoading: query.isLoading,
  };
}
