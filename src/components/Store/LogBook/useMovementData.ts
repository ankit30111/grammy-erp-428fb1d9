
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

      const { data, error } = await query.limit(1000);

      if (error) {
        console.error("❌ Error fetching movements:", error);
        throw error;
      }

      console.log("📋 Raw material movements fetched:", data?.length, "entries");
      
      // Enhanced deduplication - more aggressive approach
      const seenKeys = new Set<string>();
      const uniqueMovements = data?.filter((movement) => {
        // Create a unique key based on critical fields
        const key = `${movement.raw_material_id}-${movement.movement_type}-${movement.quantity}-${movement.reference_type}-${Math.floor(new Date(movement.created_at).getTime() / 60000)}`; // Group by minute
        
        if (seenKeys.has(key)) {
          console.log("🗑️ Removing duplicate movement:", {
            id: movement.id,
            material: movement.raw_materials?.material_code,
            type: movement.movement_type,
            quantity: movement.quantity,
            created_at: movement.created_at
          });
          return false;
        }
        
        seenKeys.add(key);
        return true;
      }) || [];
      
      // Log movement types for debugging
      const movementTypes = uniqueMovements.map(m => m.movement_type);
      const uniqueTypes = [...new Set(movementTypes)];
      console.log("📊 Movement types found:", uniqueTypes);
      
      // Log recent entries for debugging
      if (uniqueMovements.length > 0) {
        console.log("📋 Recent movements (deduplicated):", uniqueMovements.slice(0, 5).map(m => ({
          type: m.movement_type,
          material: m.raw_materials?.material_code,
          quantity: m.quantity,
          reference: m.reference_number,
          created: m.created_at
        })));
      }
      
      console.log(`📊 Deduplication: ${data?.length || 0} → ${uniqueMovements.length} entries`);
      
      return uniqueMovements;
    },
    refetchInterval: 5000, // Increased interval to reduce load
    staleTime: 2000,
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

  // Enhanced custom event listener for immediate refresh
  useEffect(() => {
    const handleCustomRefresh = () => {
      console.log("🔄 CUSTOM-REFRESH: LogBook refresh requested");
      refetch();
    };

    window.addEventListener('refreshLogBook', handleCustomRefresh);
    return () => window.removeEventListener('refreshLogBook', handleCustomRefresh);
  }, [refetch]);

  // Add listener for database changes via Supabase realtime
  useEffect(() => {
    const channel = supabase
      .channel('material-movements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_movements'
        },
        (payload) => {
          console.log('📡 Real-time material movement change:', payload);
          // Debounce the refetch to avoid too many calls
          setTimeout(() => refetch(), 1000);
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
