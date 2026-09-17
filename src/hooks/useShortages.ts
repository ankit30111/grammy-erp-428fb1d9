import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  calculateShortages,
  fetchShortageRows,
  persistShortages,
  ShortageLine,
} from "@/utils/materialShortageCalculator";
import { toast } from "sonner";

export interface ShortageRow extends ShortageLine {
  shortage_id: string | null;
  purchase_order_item_id: string | null;
  status: string;
}

/**
 * Live shortage lines (required / available / hold / balance), merged with the
 * shortages table so covered lines report themselves as covered.
 */
export const useShortages = (plantId?: string | null) => {
  return useQuery({
    queryKey: ["shortages", plantId ?? "all"],
    queryFn: async (): Promise<ShortageRow[]> => {
      const [lines, rows] = await Promise.all([
        calculateShortages(plantId),
        fetchShortageRows(plantId),
      ]);

      const byPart = new Map<string, any>();
      for (const row of rows) byPart.set(row.part_id, row);

      const merged: ShortageRow[] = lines.map((line) => {
        const row = byPart.get(line.part_id);
        byPart.delete(line.part_id);
        return {
          ...line,
          shortage_id: row?.id ?? null,
          purchase_order_item_id: row?.purchase_order_item_id ?? null,
          status: row?.purchase_order_item_id ? "COVERED" : row?.status ?? "OPEN",
        };
      });

      // Covered rows whose demand has since gone away still matter to Purchase.
      for (const row of byPart.values()) {
        merged.push({
          part_id: row.part_id,
          part_code: row.parts?.part_code ?? "",
          name: row.parts?.name ?? "",
          category: row.parts?.category ?? null,
          uom: row.parts?.uom ?? "PCS",
          required: Number(row.required_quantity || 0),
          available: Number(row.available_quantity || 0),
          hold: 0,
          balance: Number(row.available_quantity || 0) - Number(row.required_quantity || 0),
          shortage: Number(row.shortage_quantity || 0),
          needed_on: row.needed_on,
          vendor_id: row.parts?.part_vendors?.[0]?.vendor_id ?? null,
          vendor_name: row.parts?.part_vendors?.[0]?.vendors?.name ?? null,
          unit_price: row.parts?.unit_price ?? null,
          currency: row.parts?.currency ?? null,
          sources: [],
          material_name: row.parts?.name ?? "",
          total_required: Number(row.required_quantity || 0),
          available_quantity: Number(row.available_quantity || 0),
          shortage_quantity: Number(row.shortage_quantity || 0),
          vendor_info: row.parts?.part_vendors?.[0]?.vendors?.name
            ? { vendor_name: row.parts.part_vendors[0].vendors.name }
            : null,
          shortage_id: row.id,
          purchase_order_item_id: row.purchase_order_item_id,
          status: row.purchase_order_item_id ? "COVERED" : row.status,
        });
      }

      return merged;
    },
  });
};

/** Recalculates and stores the shortage list for a plant. */
export const useRefreshShortages = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plantId: string) => {
      const lines = await calculateShortages(plantId);
      return persistShortages(plantId, lines);
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["shortages"] });
      toast.success(`Shortage list refreshed — ${count} part(s) short`);
    },
    onError: (error: any) => toast.error(error?.message || "Could not refresh the shortage list"),
  });
};
