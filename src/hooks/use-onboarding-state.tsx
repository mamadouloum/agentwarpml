import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RegistrationRequest = {
  id: string;
  school_name: string;
  school_code: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

export type OnboardingState = {
  authed: boolean;
  isSuperAdmin: boolean;
  hasSchool: boolean;
  hasAnyRole: boolean;
  request: RegistrationRequest | null;
};

/**
 * Determines whether a logged-in user can enter the app or must see the
 * onboarding/pending screen:
 * - super admin or a user attached to a school/role -> full access.
 * - otherwise -> onboarding (latest registration request drives the message).
 */
export function useOnboardingState() {
  return useQuery<OnboardingState>({
    queryKey: ["onboarding-state"],
    queryFn: async () => {
      const empty: OnboardingState = {
        authed: false,
        isSuperAdmin: false,
        hasSchool: false,
        hasAnyRole: false,
        request: null,
      };
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return empty;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("school_id").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role,school_id").eq("user_id", u.user.id),
      ]);

      const isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
      const hasSchool =
        !!(profile as any)?.school_id || (roles ?? []).some((r: any) => !!r.school_id);
      const hasAnyRole = (roles ?? []).length > 0;

      const { data: request } = await (supabase as any)
        .from("school_registration_requests")
        .select("id,school_name,school_code,status,rejection_reason,created_at")
        .eq("requester_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { authed: true, isSuperAdmin, hasSchool, hasAnyRole, request: request ?? null };
    },
    staleTime: 30_000,
  });
}
