
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/**
 * Stock balances are created on demand by the stock ledger posting functions,
 * so raw materials no longer need pre-seeded stock rows. Kept as a no-op so
 * existing buttons keep working without writing to the retired `inventory` table.
 */
export const useInventorySync = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const syncRawMaterialsToInventory = useMutation({
    mutationFn: async () => {
      return {
        created: 0,
        message:
          "No seeding needed — stock rows are created automatically when material is received or posted.",
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Stock Check Complete",
        description: result.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check stock records",
        variant: "destructive",
      });
    },
  });

  return {
    syncRawMaterialsToInventory,
    isLoading: syncRawMaterialsToInventory.isPending,
  };
};
