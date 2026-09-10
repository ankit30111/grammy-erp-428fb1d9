
import { useQuery } from "@tanstack/react-query";
import { usePlantId } from "@/hooks/usePlantId";
import { fetchStockBalanceRows } from "@/utils/stockLedger";

export const useInventory = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["inventory", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      console.log("🔍 Fetching stock balance (MAIN)...");
      const rows = await fetchStockBalanceRows(plantId!, "MAIN");
      console.log("📊 Current stock balance rows:", rows.length);
      return rows;
    },
  });
};

export const useRealTimeInventory = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["inventory-real-time", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const rows = await fetchStockBalanceRows(plantId!, "MAIN");
      console.log("📦 Real-time stock balance:", rows.length, "items");
      return rows;
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time sync
  });
};
