import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Import purchases.
 * An import purchase is a normal PO ticked "Imported purchase". Once approved, its
 * lines are loaded into containers and each container is followed stage by stage.
 * Receiving is a normal GRN against the PO.
 */
const db = supabase as any;

export type ContainerStage = "ORDERED" | "LOADED" | "SHIPPED" | "IN_TRANSIT" | "INDIA_CUSTOM" | "ARRIVED" | "AT_FACTORY";

/** Stage, its label, and the column that holds the date it was reached. */
export const STAGES: { id: ContainerStage; label: string; dateField: string }[] = [
  { id: "ORDERED", label: "Ordered", dateField: "ordered_date" },
  { id: "LOADED", label: "Loaded", dateField: "loaded_date" },
  { id: "SHIPPED", label: "Shipped", dateField: "shipped_date" },
  { id: "IN_TRANSIT", label: "In transit", dateField: "in_transit_date" },
  { id: "INDIA_CUSTOM", label: "Indian customs", dateField: "india_custom_date" },
  { id: "ARRIVED", label: "Customs cleared", dateField: "arrived_date" },
  { id: "AT_FACTORY", label: "At factory", dateField: "factory_arrival_date" },
];
export const stageIndex = (s: ContainerStage) => STAGES.findIndex((x) => x.id === s);

export interface ImportPoLine {
  po_item_id: string; purchase_order_id: string; po_number: string; po_date: string; po_status: string;
  vendor_name: string; origin_country: string | null; currency: string | null;
  promised_loading_date: string | null; promised_delivery_date: string | null;
  part_id: string; part_code: string; part_name: string; uom: string | null;
  ordered: number; received: number; loaded: number; to_load: number; on_the_way: number;
}

export interface ContainerLine {
  id: string; quantity: number; cbm_occupied: number | null; purchase_order_item_id: string | null;
  part: { part_code: string; name: string; uom: string | null } | null;
  po_item: { id: string; quantity: number; purchase_order: { id: string; po_number: string; vendor: { name: string } | null } | null } | null;
}

export interface ImportContainer {
  id: string; container_number: string; current_status: ContainerStage;
  shipping_line: string | null; vessel_name: string | null; bl_number: string | null;
  invoice_number: string | null; invoice_amount: number | null; currency: string | null; freight_cost: number | null;
  planned_loaded: string | null; planned_factory: string | null; notes: string | null;
  ordered_date: string | null; loaded_date: string | null; shipped_date: string | null; in_transit_date: string | null;
  india_custom_date: string | null; arrived_date: string | null; factory_arrival_date: string | null;
  created_at: string;
  lines: ContainerLine[];
}

const CONTAINER_SELECT = `*, lines:container_materials ( id, quantity, cbm_occupied, purchase_order_item_id,
  part:parts ( part_code, name, uom ),
  po_item:purchase_order_items ( id, quantity, purchase_order:purchase_orders ( id, po_number, vendor:vendors ( name ) ) ) )`;

export function useImportPoLines() {
  return useQuery({
    queryKey: ["import-po-lines"],
    queryFn: async () => {
      const { data, error } = await db.from("import_po_lines").select("*").order("po_date", { ascending: false }).order("part_code");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r, ordered: Number(r.ordered), received: Number(r.received), loaded: Number(r.loaded),
        to_load: Number(r.to_load), on_the_way: Number(r.on_the_way),
      })) as ImportPoLine[];
    },
  });
}

export function useImportContainers() {
  return useQuery({
    queryKey: ["import-containers"],
    queryFn: async () => {
      const { data, error } = await db.from("import_containers").select(CONTAINER_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ImportContainer[];
    },
  });
}

export interface ContainerForm {
  container_number: string; shipping_line: string; vessel_name: string; bl_number: string;
  invoice_number: string; invoice_amount: string; currency: string; freight_cost: string;
  planned_loaded: string; planned_factory: string; notes: string;
}

export function useImportMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ predicate: (q) => /^import-/.test(String(q.queryKey[0] ?? "")) });
  const fail = (e: any) => toast.error(e?.message ?? "Could not save");

  return {
    /** lines = null keeps the container's lines as they are. */
    save: useMutation({
      mutationFn: async (a: { id: string | null; header: ContainerForm; lines: { purchase_order_item_id: string; quantity: number; cbm: string }[] | null }) => {
        const { data, error } = await db.rpc("container_save", { p_id: a.id, p_header: a.header, p_lines: a.lines });
        if (error) throw error;
        return data as string;
      },
      onSuccess: () => { refresh(); toast.success("Container saved"); },
      onError: fail,
    }),
    setStage: useMutation({
      mutationFn: async (a: { id: string; stage: ContainerStage; date: string | null }) => {
        const { data, error } = await db.rpc("container_set_stage", { p_id: a.id, p_stage: a.stage, p_date: a.date });
        if (error) throw error;
        return data as ContainerStage;
      },
      onSuccess: (stage) => { refresh(); toast.success(`Container is now: ${STAGES[stageIndex(stage)].label}`); },
      onError: fail,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await db.from("import_containers").delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => { refresh(); toast.success("Container deleted"); },
      onError: fail,
    }),
  };
}
