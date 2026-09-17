import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlantId } from "@/hooks/usePlantId";
import { markShortagesCovered } from "@/utils/materialShortageCalculator";

export type PoStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface NewPurchaseOrder {
  vendor_id: string;
  notes?: string;
  po_date?: string;
  currency?: string;
  projection_id?: string | null;
  is_import?: boolean;
  origin_country?: string | null;
  promised_loading_date?: string | null;
  promised_delivery_date?: string | null;
  status?: PoStatus;
  items: {
    part_id: string;
    quantity: number;
    unit_price: number;
    /** shortage row this line covers, if any */
    shortage_id?: string | null;
  }[];
}

export const usePurchaseOrders = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["purchase_orders", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `*,
           vendors ( id, name ),
           purchase_order_items (
             *,
             parts ( id, name, part_code, uom )
           )`,
        )
        .eq("plant_id", plantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // received_quantity is maintained on the item by the GRN trigger.
      return (data || []).map((po: any) => ({
        ...po,
        purchase_order_items: (po.purchase_order_items || []).map((item: any) => ({
          ...item,
          received_quantity: Number(item.received_quantity || 0),
          pending_quantity: Math.max(0, Number(item.quantity || 0) - Number(item.received_quantity || 0)),
        })),
      }));
    },
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async (orderData: NewPurchaseOrder) => {
      if (!plantId) throw new Error("No active plant selected");

      // po_number and total_amount are set by the database.
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: "",
          plant_id: plantId,
          vendor_id: orderData.vendor_id,
          projection_id: orderData.projection_id ?? null,
          status: orderData.status || "DRAFT",
          notes: orderData.notes ?? null,
          currency: orderData.currency ?? "INR",
          po_date: orderData.po_date ?? new Date().toISOString().slice(0, 10),
          is_import: orderData.is_import ?? false,
          origin_country: orderData.origin_country ?? null,
          promised_loading_date: orderData.promised_loading_date ?? null,
          promised_delivery_date: orderData.promised_delivery_date ?? null,
        })
        .select()
        .single();

      if (poError) throw poError;

      const { data: insertedItems, error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(
          orderData.items.map((item) => ({
            purchase_order_id: poData.id,
            part_id: item.part_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        )
        .select("id, part_id");

      if (itemsError) throw itemsError;

      // Report the shortage lines as covered.
      const covers = orderData.items
        .filter((item) => item.shortage_id)
        .map((item) => {
          const match = (insertedItems || []).find((i) => i.part_id === item.part_id);
          return match ? { shortage_id: item.shortage_id!, purchase_order_item_id: match.id } : null;
        })
        .filter(Boolean) as { shortage_id: string; purchase_order_item_id: string }[];

      if (covers.length > 0) await markShortagesCovered(covers);

      return poData;
    },
    onSuccess: (poData: any) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["materials-for-po"] });
      queryClient.invalidateQueries({ queryKey: ["shortages"] });

      toast({
        title: "Purchase order created",
        description: poData?.po_number ? `Purchase order ${poData.po_number} created` : "Purchase order created",
      });
    },
    onError: (error: any) => {
      console.error("Error creating PO:", error);
      toast({
        title: "Could not create the purchase order",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePOStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ poId, status }: { poId: string; status: PoStatus }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", poId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });

      const statusMap: Record<string, string> = {
        PENDING_APPROVAL: "sent for approval",
        APPROVED: "approved",
        CANCELLED: "cancelled",
      };

      toast({
        title: "Purchase order updated",
        description: `Purchase order ${statusMap[variables.status] || variables.status.toLowerCase()}`,
      });
    },
    onError: (error: any) => {
      console.error("Error updating PO status:", error);
      toast({
        title: "Could not update the purchase order",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};
