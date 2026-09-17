import { supabase } from "@/integrations/supabase/client";

/**
 * Shortage engine.
 *
 * Demand comes from projections (whatever is not produced yet). Each finished good is
 * exploded RECURSIVELY through the bom table:
 *   - PURCHASED child           -> a purchase requirement
 *   - ASSEMBLED_INLINE child    -> explode straight through it
 *   - ASSEMBLED_STOCKED child   -> consume its own stock first, explode the remainder
 *   - FINISHED_GOOD child       -> explode through it
 * Only PURCHASED parts ever reach the shortage output, so Purchase only sees buyable parts.
 */

export interface DemandSource {
  label: string;
  customer?: string | null;
  quantity: number;
  needed_on: string | null;
}

export interface ShortageLine {
  part_id: string;
  part_code: string;
  name: string;
  category: string | null;
  uom: string;
  required: number;
  available: number;
  hold: number;
  balance: number;
  shortage: number;
  needed_on: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  unit_price: number | null;
  currency: string | null;
  sources: DemandSource[];
  /* legacy field names still read by some dashboards */
  material_name: string;
  total_required: number;
  available_quantity: number;
  shortage_quantity: number;
  vendor_info: { vendor_name: string; vendor_code?: string } | null;
}

interface PartRow {
  id: string;
  part_code: string;
  name: string;
  category: string | null;
  uom: string | null;
  source_type: string;
  unit_price: number | null;
  currency: string | null;
  part_vendors?: { vendor_id: string; is_primary: boolean; vendors?: { id: string; name: string } | null }[];
}

interface BomRow {
  parent_part_id: string;
  child_part_id: string;
  quantity: number;
}

const earlier = (a: string | null, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
};

export const explodeDemand = (
  partId: string,
  quantity: number,
  bomByParent: Map<string, BomRow[]>,
  partsById: Map<string, PartRow>,
  stockLeft: Map<string, number>,
  requirements: Map<string, number>,
  seen: Set<string> = new Set(),
) => {
  if (quantity <= 0 || seen.has(partId)) return;
  const nextSeen = new Set(seen).add(partId);
  const children = bomByParent.get(partId) || [];

  for (const line of children) {
    const child = partsById.get(line.child_part_id);
    if (!child) continue;
    const needed = quantity * Number(line.quantity || 0);
    if (needed <= 0) continue;

    if (child.source_type === "PURCHASED") {
      requirements.set(child.id, (requirements.get(child.id) || 0) + needed);
      continue;
    }

    if (child.source_type === "ASSEMBLED_STOCKED") {
      const onHand = stockLeft.get(child.id) || 0;
      const used = Math.min(onHand, needed);
      stockLeft.set(child.id, onHand - used);
      const remainder = needed - used;
      if (remainder > 0) {
        explodeDemand(child.id, remainder, bomByParent, partsById, stockLeft, requirements, nextSeen);
      }
      continue;
    }

    // ASSEMBLED_INLINE and FINISHED_GOOD: explode straight through.
    explodeDemand(child.id, needed, bomByParent, partsById, stockLeft, requirements, nextSeen);
  }
};

export const calculateShortages = async (plantId?: string | null): Promise<ShortageLine[]> => {
  const [partsRes, bomRes, projRes] = await Promise.all([
    supabase
      .from("parts")
      .select(
        `id, part_code, name, category, uom, source_type, unit_price, currency,
         part_vendors ( vendor_id, is_primary, vendors ( id, name ) )`,
      ),
    supabase.from("bom").select("parent_part_id, child_part_id, quantity").eq("is_active", true),
    supabase
      .from("projections")
      .select(`id, part_id, quantity, produced_quantity, month, customers!customer_id ( name ), parts!part_id ( part_code, name )`),
  ]);

  if (partsRes.error) throw partsRes.error;
  if (bomRes.error) throw bomRes.error;
  if (projRes.error) throw projRes.error;

  let stockQuery = supabase
    .from("stock_balance")
    .select("part_id, quantity, plant_id, stock_locations!location_id ( location_type )");
  if (plantId) stockQuery = stockQuery.eq("plant_id", plantId);
  const stockRes = await stockQuery;
  if (stockRes.error) throw stockRes.error;

  let holdQuery = supabase.from("stock_holds").select("part_id, quantity, plant_id, status").eq("status", "ACTIVE");
  if (plantId) holdQuery = holdQuery.eq("plant_id", plantId);
  const holdRes = await holdQuery;
  if (holdRes.error) throw holdRes.error;

  const partsById = new Map<string, PartRow>((partsRes.data || []).map((p: any) => [p.id, p]));
  const bomByParent = new Map<string, BomRow[]>();
  for (const line of bomRes.data || []) {
    const list = bomByParent.get(line.parent_part_id) || [];
    list.push(line as BomRow);
    bomByParent.set(line.parent_part_id, list);
  }

  const available = new Map<string, number>();
  for (const row of stockRes.data || []) {
    const type = (row as any).stock_locations?.location_type;
    if (type && type !== "STORE") continue; // quarantine and reject stock is not available
    available.set(row.part_id, (available.get(row.part_id) || 0) + Number(row.quantity || 0));
  }

  const holds = new Map<string, number>();
  for (const row of holdRes.data || []) {
    holds.set(row.part_id, (holds.get(row.part_id) || 0) + Number(row.quantity || 0));
  }

  const stockLeft = new Map(available);
  const requirements = new Map<string, number>();
  const sources = new Map<string, DemandSource[]>();
  const neededOn = new Map<string, string | null>();

  for (const projection of projRes.data || []) {
    const outstanding = Number(projection.quantity || 0) - Number(projection.produced_quantity || 0);
    if (outstanding <= 0) continue;

    const before = new Map(requirements);
    explodeDemand(projection.part_id, outstanding, bomByParent, partsById, stockLeft, requirements);

    for (const [partId, total] of requirements) {
      const delta = total - (before.get(partId) || 0);
      if (delta <= 0) continue;
      const list = sources.get(partId) || [];
      list.push({
        label: `${(projection as any).parts?.part_code || ""} ${(projection as any).parts?.name || ""}`.trim(),
        customer: (projection as any).customers?.name ?? null,
        quantity: delta,
        needed_on: projection.month,
      });
      sources.set(partId, list);
      neededOn.set(partId, earlier(neededOn.get(partId) ?? null, projection.month));
    }
  }

  const lines: ShortageLine[] = [];
  for (const [partId, required] of requirements) {
    const part = partsById.get(partId);
    if (!part || part.source_type !== "PURCHASED") continue;
    const av = available.get(partId) || 0;
    const hold = holds.get(partId) || 0;
    const balance = av - hold - required;
    const primaryVendor =
      part.part_vendors?.find((v) => v.is_primary) || part.part_vendors?.[0] || null;

    lines.push({
      part_id: partId,
      part_code: part.part_code,
      name: part.name,
      category: part.category,
      uom: part.uom || "PCS",
      required,
      available: av,
      hold,
      balance,
      shortage: Math.max(0, -balance),
      needed_on: neededOn.get(partId) ?? null,
      vendor_id: primaryVendor?.vendor_id ?? null,
      vendor_name: primaryVendor?.vendors?.name ?? null,
      unit_price: part.unit_price,
      currency: part.currency,
      sources: sources.get(partId) || [],
      material_name: part.name,
      total_required: required,
      available_quantity: av,
      shortage_quantity: Math.max(0, -balance),
      vendor_info: primaryVendor?.vendors?.name ? { vendor_name: primaryVendor.vendors.name } : null,
    });
  }

  return lines.sort((a, b) => b.shortage - a.shortage || a.part_code.localeCompare(b.part_code));
};

/**
 * Writes the computed shortages into the shortages table so Purchase and the
 * dashboards read one shared list. Rows already covered by a purchase order item,
 * or tied to a production order or schedule, are left untouched.
 */
export const persistShortages = async (plantId: string, lines: ShortageLine[]) => {
  const { error: deleteError } = await supabase
    .from("shortages")
    .delete()
    .eq("plant_id", plantId)
    .is("purchase_order_item_id", null)
    .is("production_order_id", null)
    .is("production_schedule_id", null);
  if (deleteError) throw deleteError;

  const rows = lines
    .filter((line) => line.shortage > 0)
    .map((line) => ({
      plant_id: plantId,
      part_id: line.part_id,
      required_quantity: line.required,
      available_quantity: line.available,
      shortage_quantity: line.shortage,
      needed_on: line.needed_on,
      status: "OPEN",
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("shortages").insert(rows);
  if (error) throw error;
  return rows.length;
};

/** Reads the shortages table, enriched with part and vendor detail. */
export const fetchShortageRows = async (plantId?: string | null) => {
  let query = supabase
    .from("shortages")
    .select(
      `id, plant_id, part_id, required_quantity, available_quantity, shortage_quantity, needed_on,
       purchase_order_item_id, status, created_at,
       parts!part_id ( id, part_code, name, category, uom, source_type, unit_price, currency,
         part_vendors ( vendor_id, is_primary, vendors ( id, name ) ) )`,
    )
    .order("needed_on", { ascending: true, nullsFirst: false });
  if (plantId) query = query.eq("plant_id", plantId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/** Links a shortage row to the purchase order item that covers it. */
export const markShortagesCovered = async (
  covers: { shortage_id: string; purchase_order_item_id: string }[],
) => {
  for (const cover of covers) {
    const { error } = await supabase
      .from("shortages")
      .update({ purchase_order_item_id: cover.purchase_order_item_id, status: "COVERED" })
      .eq("id", cover.shortage_id);
    if (error) throw error;
  }
};

/* ---- names kept for screens that already import them ---- */
export type MaterialShortage = ShortageLine;
export const calculateMaterialShortages = async (
  _projectionIds?: string[],
  plantId?: string | null,
) => calculateShortages(plantId ?? null);
