
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMaterialDispatchTracking = (productionOrderId: string, materialIds: string[] = []) => {
  return useQuery({
    queryKey: ["material-dispatch-tracking", productionOrderId, materialIds],
    queryFn: async () => {
      if (!materialIds.length) return {};
      
      console.log("🔍 Fetching material dispatch tracking for:", { productionOrderId, materialIds });
      
      const { data, error } = await supabase
        .from("material_movements")
        .select(`
          raw_material_id,
          quantity,
          created_at,
          movement_type,
          reference_number,
          notes,
          raw_materials!inner(
            material_code,
            name
          )
        `)
        .eq("movement_type", "ISSUED_TO_PRODUCTION")
        .eq("reference_type", "PRODUCTION_VOUCHER")
        .in("raw_material_id", materialIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching material dispatch tracking:", error);
        throw error;
      }

      console.log("📊 Material dispatch tracking data:", data);
      
      // Group by material and calculate totals
      const groupedData = data?.reduce((acc, item) => {
        const materialId = item.raw_material_id;
        
        if (!acc[materialId]) {
          acc[materialId] = {
            materialCode: item.raw_materials?.material_code,
            materialName: item.raw_materials?.name,
            totalSent: 0,
            dispatches: []
          };
        }
        
        acc[materialId].totalSent += item.quantity;
        acc[materialId].dispatches.push({
          quantity: item.quantity,
          createdAt: item.created_at,
          referenceNumber: item.reference_number,
          notes: item.notes
        });
        
        return acc;
      }, {} as Record<string, {
        materialCode: string;
        materialName: string;
        totalSent: number;
        dispatches: Array<{
          quantity: number;
          createdAt: string;
          referenceNumber: string;
          notes: string;
        }>;
      }>) || {};

      return groupedData;
    },
    enabled: materialIds.length > 0,
    refetchInterval: 5000, // Real-time updates every 5 seconds
    staleTime: 2000,
  });
};

export const calculateMaterialBalance = (
  requiredQuantity: number, 
  sentQuantity: number
): { balance: number; isComplete: boolean; percentage: number } => {
  const balance = Math.max(0, requiredQuantity - sentQuantity);
  const isComplete = balance === 0;
  const percentage = requiredQuantity > 0 ? Math.min(100, (sentQuantity / requiredQuantity) * 100) : 0;
  
  return { balance, isComplete, percentage };
};
