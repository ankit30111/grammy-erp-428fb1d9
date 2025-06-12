
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useProductionDiscrepancies = (productionOrderId?: string) => {
  const queryClient = useQueryClient();

  // Fetch production discrepancies
  const { data: discrepancies = [], isLoading } = useQuery({
    queryKey: ["production-discrepancies", productionOrderId],
    queryFn: async () => {
      console.log("🔍 Fetching production discrepancies for:", productionOrderId);

      let query = supabase
        .from("production_discrepancies")
        .select(`
          *,
          raw_materials!inner(
            material_code,
            name
          ),
          production_orders!inner(
            voucher_number,
            products!inner(
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (productionOrderId) {
        query = query.eq("production_order_id", productionOrderId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching production discrepancies:", error);
        throw error;
      }

      console.log("📊 Production discrepancies fetched:", data);
      return data || [];
    },
    enabled: true,
    refetchInterval: 5000, // Real-time updates
  });

  // Resolve discrepancy mutation
  const resolveDiscrepancyMutation = useMutation({
    mutationFn: async ({ 
      discrepancyId, 
      action, 
      resolutionNotes 
    }: { 
      discrepancyId: string; 
      action: 'APPROVE' | 'REJECT'; 
      resolutionNotes?: string;
    }) => {
      console.log("🔄 Resolving production discrepancy:", {
        discrepancyId,
        action,
        resolutionNotes
      });

      const { error } = await supabase.rpc("resolve_production_discrepancy", {
        p_discrepancy_id: discrepancyId,
        p_action: action,
        p_reviewed_by: null, // Will be handled by auth context later
        p_resolution_notes: resolutionNotes
      });

      if (error) {
        console.error("❌ Error resolving production discrepancy:", error);
        throw error;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["production-feedback"] });
      
      toast.success(
        variables.action === 'APPROVE' 
          ? "Production discrepancy approved - inventory updated" 
          : "Production discrepancy rejected"
      );
    },
    onError: (error) => {
      console.error("❌ Failed to resolve production discrepancy:", error);
      toast.error("Failed to resolve production discrepancy");
    }
  });

  return {
    discrepancies,
    isLoading,
    resolveDiscrepancy: resolveDiscrepancyMutation.mutate,
    isResolving: resolveDiscrepancyMutation.isPending
  };
};
