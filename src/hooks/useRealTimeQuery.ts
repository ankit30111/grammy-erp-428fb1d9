
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface UseRealTimeQueryOptions {
  queryKey: string[];
  queryFn: () => Promise<any>;
  tableName?: string;
  refetchInterval?: number;
}

export const useRealTimeQuery = ({
  queryKey,
  queryFn,
  tableName,
  refetchInterval = 30000, // 30 seconds default
}: UseRealTimeQueryOptions) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn,
    refetchInterval,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always consider data stale for real-time updates
  });

  useEffect(() => {
    if (!tableName) return;

    console.log(`🔄 Setting up real-time subscription for table: ${tableName}`);

    const channel = supabase
      .channel(`${tableName}-changes`)
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

    return () => {
      console.log(`🔌 Cleaning up subscription for ${tableName}`);
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, tableName]);

  return query;
};
