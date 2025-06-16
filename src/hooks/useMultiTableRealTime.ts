
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface UseMultiTableRealTimeOptions {
  queryKey: string[];
  tables: string[];
}

export const useMultiTableRealTime = ({
  queryKey,
  tables,
}: UseMultiTableRealTimeOptions) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tables.length) return;

    console.log(`🔄 Setting up multi-table subscriptions for:`, tables);

    const channels = tables.map(tableName => {
      return supabase
        .channel(`${tableName}-changes-${queryKey.join('-')}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName
          },
          (payload) => {
            console.log(`📡 Real-time update received for ${tableName}:`, payload);
            // Invalidate and refetch the query when data changes
            queryClient.invalidateQueries({ queryKey });
          }
        )
        .subscribe();
    });

    return () => {
      console.log(`🔌 Cleaning up subscriptions for:`, tables);
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [queryClient, queryKey, tables]);
};
