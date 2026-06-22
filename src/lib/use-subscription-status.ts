import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { useRealtimeSync } from "@/lib/use-realtime";

export const GRACE_PERIOD_DAYS = 7;

export type SubscriptionState = {
  loading: boolean;
  status: string | null;
  plan: string | null;
  periodEnd: string | null;
  graceEnd: string | null;
  daysLeft: number | null;
  graceDaysLeft: number | null;
  isActive: boolean;
  isExpired: boolean;
  inGrace: boolean;
  isBlocked: boolean;
  isMissing: boolean;
};

/**
 * Live subscription status for the current school. Subscribes to realtime
 * changes on `school_subscriptions` so any grant / revoke / extension from
 * the super-admin is reflected immediately in every connected client.
 *
 * Grace period: after `current_period_end`, the school keeps access for
 * GRACE_PERIOD_DAYS additional days (status surfaced as `inGrace`) before
 * the gate finally blocks the modules.
 */
export function useSubscriptionStatus(): SubscriptionState {
  const schoolId = useCurrentSchool();
  useRealtimeSync(["school_subscriptions"], [["school-subscription-live", schoolId ?? undefined]]);

  const { data, isLoading } = useQuery({
    queryKey: ["school-subscription-live", schoolId ?? undefined],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_subscriptions")
        .select("status, plan, current_period_end")
        .eq("school_id", schoolId!)
        .maybeSingle();
      return data;
    },
  });

  const periodEnd = data?.current_period_end ?? null;
  const periodEndMs = periodEnd ? new Date(periodEnd).getTime() : null;
  const now = Date.now();
  const expired = periodEndMs ? periodEndMs < now : false;
  const graceEndMs = periodEndMs ? periodEndMs + GRACE_PERIOD_DAYS * 86400000 : null;
  const graceEnd = graceEndMs ? new Date(graceEndMs).toISOString() : null;
  const inGrace = expired && graceEndMs !== null && now < graceEndMs;
  const status = data?.status ?? null;
  const statusOk = status === "active" || status === "trialing";
  const isActive = statusOk && !expired;
  const isBlocked = !isLoading && (!data || (!isActive && !inGrace));

  return {
    loading: isLoading,
    status,
    plan: data?.plan ?? null,
    periodEnd,
    graceEnd,
    daysLeft: periodEndMs ? Math.ceil((periodEndMs - now) / 86400000) : null,
    graceDaysLeft:
      graceEndMs && expired ? Math.max(0, Math.ceil((graceEndMs - now) / 86400000)) : null,
    isActive,
    isExpired: expired,
    inGrace: inGrace && statusOk,
    isBlocked,
    isMissing: !data && !isLoading,
  };
}
