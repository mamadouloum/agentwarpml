import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "schools", "school_subscriptions", "subscription_invoices",
  "profiles", "user_roles", "role_permissions",
  "classes", "students", "teacher_assignments",
  "payments", "invoices", "attendances", "grades", "homework",
  "announcements", "messages", "subjects", "schedules",
];

/**
 * Mounts once inside the authenticated layout and broadcasts Postgres
 * changes by invalidating all React Query caches. This gives every page a
 * live-data feel without explicit per-page subscriptions.
 */
export function RealtimeBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel("global-rt");
    TABLES.forEach((t) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: t },
        () => {
          // Invalidate everything currently observed
          qc.invalidateQueries();
        },
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return null;
}
