
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BOMType, ProductionLineAssignment } from "@/types/bom";

export const useProductionLineAssignments = (productionOrderId: string) => {
  const queryClient = useQueryClient();

  // Fetch existing line assignments for this production order
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["production-line-assignments", productionOrderId],
    queryFn: async () => {
      if (!productionOrderId) return [];

      console.log("🔍 Fetching production line assignments for:", productionOrderId);

      const { data, error } = await supabase
        .from("production_line_assignments")
        .select("*")
        .eq("production_order_id", productionOrderId);

      if (error) {
        console.error("❌ Error fetching line assignments:", error);
        throw error;
      }

      console.log("📋 Line assignments fetched:", data);
      return data as ProductionLineAssignment[];
    },
    enabled: !!productionOrderId,
  });

  // Assign production line to BOM category
  const assignLineMutation = useMutation({
    mutationFn: async ({ 
      bomCategory, 
      productionLine 
    }: { 
      bomCategory: BOMType; 
      productionLine: string;
    }) => {
      console.log("📝 Assigning production line:", {
        productionOrderId,
        bomCategory,
        productionLine
      });

      const { data, error } = await supabase
        .from("production_line_assignments")
        .upsert({
          production_order_id: productionOrderId,
          bom_category: bomCategory,
          production_line: productionLine,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error assigning production line:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["production-line-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
      toast.success(`${data.bom_category.replace('_', ' ')} assigned to ${data.production_line}`);
    },
    onError: (error) => {
      console.error("❌ Failed to assign production line:", error);
      toast.error(`Failed to assign production line: ${error.message}`);
    }
  });

  const getAssignmentForCategory = (category: BOMType): string | undefined => {
    return assignments.find(a => a.bom_category === category)?.production_line;
  };

  return {
    assignments,
    isLoading,
    assignLine: assignLineMutation.mutate,
    isAssigning: assignLineMutation.isPending,
    getAssignmentForCategory
  };
};
