import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentSchool() {
  const { data } = useQuery({
    queryKey: ["current-school"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("school_id").eq("id", u.user.id).maybeSingle();
      return data?.school_id ?? null;
    },
  });
  return data ?? null;
}
