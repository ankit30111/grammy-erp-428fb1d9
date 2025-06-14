
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

      // Client-side deduplication based on reference and time proximity
      const deduplicatedData = data?.filter((movement, index, arr) => {
        const duplicate = arr.find((other, otherIndex) => {
          if (otherIndex >= index) return false;
          
          const timeDiff = Math.abs(
            new Date(movement.created_at).getTime() - new Date(other.created_at).getTime()
          );
          
          return (
            movement.raw_material_id === other.raw_material_id &&
            movement.movement_type === other.movement_type &&
            movement.quantity === other.quantity &&
            movement.reference_number === other.reference_number &&
            timeDiff < 60000 // Within 1 minute
          );
        });
        
        return !duplicate;
      }) || [];

      console.log("📋 Material movements fetched:", deduplicatedData.length, "entries (after deduplication)");
      
      const movementTypes = deduplicatedData.map(m => m.movement_type);
      const uniqueTypes = [...new Set(movementTypes)];
      console.log("📊 Movement types found:", uniqueTypes);
      
      return deduplicatedData;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Auto-refresh when new materials are dispatched or received
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'material_dispatched' || e.key === 'material_received') {
        console.log("🔄 AUTO-REFRESH: Material movement detected");
        refetch();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  return {
    movements: movements as MaterialMovement[],
    isLoading,
    refetch
  };
};
