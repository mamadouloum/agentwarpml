import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REPORT_CARDS_MODULE = "report_cards";

export type ReportCardAccess = {
  isAdmin: boolean;
  canView: boolean;
  canDownload: boolean;
};

/**
 * Who may view / download bulletins:
 * - school_admin & super_admin: always full access.
 * - others: granted via role_permissions (module 'report_cards'):
 *     can_read  -> can view,
 *     can_write -> can download / generate.
 */
export function useReportCardAccess() {
  return useQuery<ReportCardAccess>({
    queryKey: ["report-card-access"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { isAdmin: false, canView: false, canDownload: false };

      const { data: roles } = await supabase
        .from("user_roles")
        .select("id,role")
        .eq("user_id", u.user.id);

      const isAdmin = (roles ?? []).some(
        (r: any) => r.role === "school_admin" || r.role === "super_admin",
      );
      if (isAdmin) return { isAdmin: true, canView: true, canDownload: true };

      const roleIds = (roles ?? []).map((r: any) => r.id);
      if (!roleIds.length) return { isAdmin: false, canView: false, canDownload: false };

      const { data: perms } = await supabase
        .from("role_permissions")
        .select("can_read,can_write")
        .in("user_role_id", roleIds)
        .eq("module", REPORT_CARDS_MODULE);

      const canView = (perms ?? []).some((p: any) => p.can_read || p.can_write);
      const canDownload = (perms ?? []).some((p: any) => p.can_write);
      return { isAdmin: false, canView, canDownload };
    },
    staleTime: 60_000,
  });
}
