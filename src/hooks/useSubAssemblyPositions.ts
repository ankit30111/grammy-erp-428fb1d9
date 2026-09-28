import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { attachParentVouchers } from "@/utils/voucherLinks";

/**
 * Where every sub-assembly stands, for planning.
 *
 *   in store      built for stock, OQC passed, sitting in the Main Store
 *   held          what finished-good vouchers still need FROM THE STORE (their
 *                 kit has not gone yet). A voucher's linked sub-assembly vouchers
 *                 are not held: they go straight to its line after OQC.
 *   being built   open stock-build vouchers (no parent), not yet through OQC.
 *                 Vouchers built for a finished-good voucher are listed but not
 *                 counted: that output is already spoken for.
 *   projections   finished goods still to be vouchered x quantity per set
 *
 *   free    = in store + being built - held
 *   to make = held + projections - in store - being built   (never below zero)
 *
 * The raw parts of a sub-assembly are never counted here: they left the store
 * with the sub-assembly's own kit, and the finished-good voucher only ever
 * holds and issues the sub-assembly itself.
 */

/** Voucher states that no longer hold or produce anything. */
export const CLOSED_VOUCHER_STATES = ["OQC_PASSED", "OQC_FAILED", "CANCELLED"];

export interface SubAssemblyVoucherRef {
  id: string;
  voucher_number: string;
  quantity: number;
  status: string;
  planned_date: string;
  /** The finished-good voucher it was issued for; null = stock build */
  for_voucher: string | null;
  for_product: string | null;
}

export interface SubAssemblyHoldRef {
  voucher_number: string;
  product_code: string | null;
  quantity: number;
  order_id: string;
}

export interface SubAssemblyPosition {
  id: string;
  part_code: string;
  name: string;
  uom: string;
  hasBom: boolean;
  bomLines: number;
  /** Finished-good families it goes into, or "Battery packs" */
  families: string[];
  usedIn: { id: string; part_code: string; qps: number }[];
  /** Sub-assemblies inside this one (e.g. the printed tube inside the mic) */
  children: { id: string; qps: number }[];
  /** Brand version: the brand; null for common parts */
  brand: string | null;
  branded_from: string | null;
  /** A base part built per brand: schedule one of its brand versions instead */
  perBrand: boolean;
  inStore: number;
  held: number;
  holds: SubAssemblyHoldRef[];
  beingBuilt: number;
  vouchers: SubAssemblyVoucherRef[];
  projectionNeed: number;
  free: number;
  toMake: number;
}

export const BATTERY_FAMILY = "Battery packs";
export const UNUSED_FAMILY = "Not on a product yet";

export const useSubAssemblyPositions = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["subassembly-positions", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const db = supabase as any;
      const [partsRes, catsRes, locRes, projRes] = await Promise.all([
        db.from("parts")
          .select("id, part_code, name, uom, category, made_in_house, source_type, brand, branded_from, brand_relevant")
          .in("source_type", ["ASSEMBLED_STOCKED", "FINISHED_GOOD"])
          .eq("is_active", true),
        db.from("part_categories").select("prefix, name"),
        db.from("stock_locations").select("id").eq("plant_id", plantId).eq("code", "MAIN").maybeSingle(),
        db.from("projections").select("part_id, quantity, vouchered_quantity, produced_quantity"),
      ]);
      for (const r of [partsRes, catsRes, locRes, projRes]) if (r.error) throw r.error;

      const parts: any[] = partsRes.data ?? [];
      const subs = parts.filter((p) => p.source_type === "ASSEMBLED_STOCKED");
      const fgs = new Map(parts.filter((p) => p.source_type === "FINISHED_GOOD").map((p) => [p.id, p]));
      const catName = new Map<string, string>((catsRes.data ?? []).map((c: any) => [c.prefix, c.name]));
      const subIds = subs.map((p) => p.id);
      if (subIds.length === 0) return [] as SubAssemblyPosition[];

      const [bomRes, stockRes, holdRes, orderRes] = await Promise.all([
        db.from("bom").select("parent_part_id, child_part_id, quantity")
          .eq("is_active", true)
          .or(`parent_part_id.in.(${subIds.join(",")}),child_part_id.in.(${subIds.join(",")})`),
        locRes.data
          ? db.from("stock_balance").select("part_id, quantity").eq("plant_id", plantId)
              .eq("location_id", locRes.data.id).in("part_id", subIds)
          : Promise.resolve({ data: [], error: null }),
        db.from("stock_holds")
          .select("part_id, quantity, production_order_id, production_orders!production_order_id ( voucher_number, parts!part_id ( part_code ) )")
          .eq("plant_id", plantId).eq("status", "ACTIVE").in("part_id", subIds),
        db.from("production_orders")
          .select("id, part_id, voucher_number, quantity, status, planned_date, parent_order_id")
          .eq("plant_id", plantId).in("part_id", subIds)
          .not("status", "in", `(${CLOSED_VOUCHER_STATES.join(",")})`),
      ]);
      for (const r of [bomRes, stockRes, holdRes, orderRes]) if (r.error) throw r.error;

      const bom: any[] = bomRes.data ?? [];
      const openOrders = await attachParentVouchers((orderRes.data ?? []) as any[]);
      const toVoucher = new Map<string, number>();
      for (const pr of projRes.data ?? []) {
        // What is not on a voucher yet. Vouchered sets already hold their parts.
        const left = Number(pr.quantity || 0) - Math.max(Number(pr.vouchered_quantity || 0), Number(pr.produced_quantity || 0));
        if (left > 0) toVoucher.set(pr.part_id, (toVoucher.get(pr.part_id) || 0) + left);
      }

      return subs.map((p): SubAssemblyPosition => {
        const own = bom.filter((b) => b.parent_part_id === p.id);
        const subSet = new Set(subIds);
        const children = own
          .filter((b) => subSet.has(b.child_part_id) && Number(b.quantity || 0) > 0)
          .map((b) => ({ id: b.child_part_id, qps: Number(b.quantity) }));
        const usedIn = bom
          .filter((b) => b.child_part_id === p.id && fgs.has(b.parent_part_id))
          .map((b) => ({ id: b.parent_part_id, part_code: fgs.get(b.parent_part_id).part_code, qps: Number(b.quantity || 0) }));
        const families = new Set<string>();
        if (p.made_in_house && !p.branded_from) families.add(BATTERY_FAMILY);
        for (const u of usedIn) families.add(catName.get(fgs.get(u.id)?.category) ?? "Other");
        if (families.size === 0) families.add(UNUSED_FAMILY);

        const inStore = (stockRes.data ?? []).filter((s: any) => s.part_id === p.id)
          .reduce((a: number, s: any) => a + Number(s.quantity || 0), 0);
        const holds: SubAssemblyHoldRef[] = (holdRes.data ?? []).filter((h: any) => h.part_id === p.id).map((h: any) => ({
          order_id: h.production_order_id,
          voucher_number: h.production_orders?.voucher_number ?? "",
          product_code: h.production_orders?.parts?.part_code ?? null,
          quantity: Number(h.quantity || 0),
        }));
        const held = holds.reduce((a, h) => a + h.quantity, 0);
        const vouchers: SubAssemblyVoucherRef[] = openOrders.filter((o: any) => o.part_id === p.id).map((o: any) => ({
          id: o.id,
          voucher_number: o.voucher_number,
          quantity: Number(o.quantity || 0),
          status: o.status,
          planned_date: o.planned_date,
          for_voucher: o.parent?.voucher_number ?? null,
          for_product: o.parent?.part_code ?? null,
        }));
        const beingBuilt = vouchers.filter((v) => !v.for_voucher).reduce((a, v) => a + v.quantity, 0);
        const projectionNeed = usedIn.reduce((a, u) => a + (toVoucher.get(u.id) || 0) * u.qps, 0);
        const free = inStore + beingBuilt - held;

        return {
          id: p.id,
          part_code: p.part_code,
          name: p.name,
          uom: p.uom || "PCS",
          hasBom: own.length > 0,
          bomLines: own.length,
          families: [...families],
          usedIn,
          children,
          brand: p.branded_from ? p.brand : null,
          branded_from: p.branded_from ?? null,
          perBrand: !p.branded_from && !!p.brand_relevant,
          inStore,
          held,
          holds,
          beingBuilt,
          vouchers,
          projectionNeed,
          free,
          toMake: Math.max(0, held + projectionNeed - inStore - beingBuilt),
        };
      }).sort((a, b) => a.part_code.localeCompare(b.part_code));
    },
  });
};
