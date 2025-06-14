
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaterialMovement {
  id: string;
  created_at: string;
  movement_type: string;
  raw_material_id: string;
  quantity: number;
  reference_id: string;
  reference_type: string;
  reference_number: string;
  notes: string;
  raw_materials?: {
    material_code: string;
    name: string;
    category: string;
  };
}

export const useMovementData = (filterType: string) => {
  const { data: movements = [], isLoading, refetch } = useQuery({
    queryKey: ["material-movements-logbook", filterType],
    queryFn: async () => {
      console.log("🔍 Fetching material movements for LogBook...", { filterType });
      
      let query = supabase
        .from("material_movements")
        .select(`
          id,
          created_at,
          movement_type,
          raw_material_id,
          quantity,
          reference_id,
          reference_type,
          reference_number,
          notes,
          raw_materials!inner(
            material_code,
            name,
            category
          )
        `)
        .order("created_at", { ascending: false });

      // Apply movement type filter
      if (filterType !== "all") {
        query = query.eq("movement_type", filterType);
      }

      const { data, error } = await query.limit(500);

      if (error) {
        console.error("❌ Error fetching movements:", error);
        throw error;
      }

      // Since we've cleaned up duplicates in the database, minimal client-side filtering is needed
      const cleanData = data || [];

      console.log("📋 Material movements fetched:", cleanData.length, "entries (post-cleanup)");
      
      const movementTypes = cleanData.map(m => m.movement_type);
      const uniqueTypes = [...new Set(movementTypes)];
      console.log("📊 Movement types found:", uniqueTypes);
      
      return cleanData;
    },
    refetchInterval: 10000, // Increased interval since we have better deduplication
    staleTime: 5000, // Cache for 5 seconds
  });

  // Auto-refresh when new materials are dispatched or received
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'material_dispatched' || e.key === 'material_received' || e.key === 'material_request_created') {
        console.log("🔄 AUTO-REFRESH: Material movement detected");
        refetch();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  // Real-time subscription for immediate updates
  useEffect(() => {
    const channel = supabase
      .channel('material-movements-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'material_movements'
        },
        (payload) => {
          console.log('📡 Real-time update detected:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return {
    movements: movements as MaterialMovement[],
    isLoading,
    refetch
  };
};
