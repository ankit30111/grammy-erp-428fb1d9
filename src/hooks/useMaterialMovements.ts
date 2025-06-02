
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMaterialMovements = () => {
  return useQuery({
    queryKey: ["material-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_movements")
        .select(`
          *,
          raw_materials (
            material_code,
            name
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useLogMaterialMovement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      rawMaterialId,
      quantity,
      movementType,
      referenceType,
      referenceId,
      referenceNumber,
      issuedTo,
      notes,
    }: {
      rawMaterialId: string;
      quantity: number;
      movementType: "RECEIVED" | "ISSUED";
      referenceType: "GRN" | "PRODUCTION_VOUCHER" | "SPARE_ORDER";
      referenceId: string;
      referenceNumber: string;
      issuedTo?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("material_movements")
        .insert({
          raw_material_id: rawMaterialId,
          quantity,
          movement_type: movementType,
          reference_type: referenceType,
          reference_id: referenceId,
          reference_number: referenceNumber,
          issued_to: issuedTo,
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-movements"] });
    },
  });
};
