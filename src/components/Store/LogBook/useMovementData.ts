
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
      console.log("🔍 Fetching ENHANCED material movements for LogBook...", { filterType });
      
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

      const { data, error } = await query.limit(1000); // Increased limit for complete view

      if (error) {
        console.error("❌ Error fetching movements:", error);
        throw error;
      }

      console.log("📋 ENHANCED material movements fetched:", data?.length, "entries");
      
      // Log all movement types for debugging
      const movementTypes = data?.map(m => m.movement_type) || [];
      const uniqueTypes = [...new Set(movementTypes)];
      console.log("📊 Movement types found:", uniqueTypes);
      
      // Log recent entries for debugging
      if (data && data.length > 0) {
        console.log("📋 Recent movements:", data.slice(0, 5).map(m => ({
          type: m.movement_type,
          material: m.raw_materials?.material_code,
          quantity: m.quantity,
          reference: m.reference_number,
          created: m.created_at
        })));
      }
      
      return data || [];
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds
    staleTime: 1000,
  });

  // Enhanced auto-refresh when new materials are dispatched or received
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'material_dispatched' || e.key === 'material_received') {
        console.log("🔄 AUTO-REFRESH: Material movement detected, refreshing LogBook");
        refetch();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  // Also listen for custom events
  useEffect(() => {
    const handleCustomRefresh = () => {
      console.log("🔄 CUSTOM-REFRESH: LogBook refresh requested");
      refetch();
    };

    window.addEventListener('refreshLogBook', handleCustomRefresh);
    return () => window.removeEventListener('refreshLogBook', handleCustomRefresh);
  }, [refetch]);

  return {
    movements: movements as MaterialMovement[],
    isLoading,
    refetch
  };
};
