import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on given tables and invalidate
 * the given query keys whenever any change occurs.
 */
export function useRealtimeSync(tables: string[], queryKeys: (string | (string | undefined)[])[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 7)}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: t },
        () => {
          queryKeys.forEach((k) => {
            qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
          });
        },
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join("|")]);
}
