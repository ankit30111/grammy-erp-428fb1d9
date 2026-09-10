import { supabase } from "@/integrations/supabase/client";

/**
 * Single access point for the stock ledger.
 *
 * All stock changes go through `post_stock_movement` / `post_stock_movements`
 * (SECURITY DEFINER, atomic, append-only ledger + non-negative balance).
 * All stock reads come from `stock_balance`. The legacy mutable `inventory`
 * table is no longer read or written by these paths.
 */

export type StockLocationCode = "MAIN" | "QUAR" | "REJECT";

export interface StockMovement {
  plant_id: string;
  raw_material_id: string;
  location_id: string;
  qty_delta: number;
  movement_type: string;
  reason_code?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  reference_number?: string | null;
  notes?: string | null;
}

const locationCache = new Map<string, string>();

/** Resolve (and cache) the id of a stock location for a plant. */
export async function getStockLocationId(
  plantId: string,
  code: StockLocationCode
): Promise<string> {
  if (!plantId) throw new Error("No active plant selected");
  const key = `${plantId}:${code}`;
  const cached = locationCache.get(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("stock_locations")
    .select("id")
    .eq("plant_id", plantId)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`Stock location "${code}" is not configured for this plant`);
  }
  locationCache.set(key, data.id);
  return data.id;
}

/** Post one or more movements atomically through the ledger function. */
export async function postStockMovements(movements: StockMovement[]): Promise<void> {
  const payload = movements.filter((m) => Number(m.qty_delta) !== 0);
  if (payload.length === 0) return;

  const { error } = await supabase.rpc("post_stock_movements", {
    p_movements: payload as any,
  });
  if (error) throw error;
}

export async function postStockMovement(movement: StockMovement): Promise<void> {
  return postStockMovements([movement]);
}

/**
 * Idempotency guard. `post_stock_movement` has no idempotency-key parameter,
 * so we check for an existing ledger entry carrying the same deterministic
 * (reference_type, reference_id) pair before posting again.
 */
export async function hasLedgerEntry(
  referenceType: string,
  referenceId: string,
  movementType?: string
): Promise<boolean> {
  let q = supabase
    .from("stock_ledger")
    .select("id")
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .limit(1);
  if (movementType) q = q.eq("movement_type", movementType);

  const { data, error } = await q;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Read stock for a plant/location from `stock_balance`, mapped to the shape
 * the existing screens already expect (quantity / minimum_stock / location /
 * last_updated / raw_materials).
 */
export async function fetchStockBalanceRows(
  plantId: string,
  code: StockLocationCode = "MAIN"
): Promise<any[]> {
  const locationId = await getStockLocationId(plantId, code);

  const { data, error } = await supabase
    .from("stock_balance")
    .select(
      `
      id,
      plant_id,
      raw_material_id,
      location_id,
      quantity,
      min_stock,
      updated_at,
      raw_materials!raw_material_id (
        id,
        material_code,
        name,
        category
      )
    `
    )
    .eq("plant_id", plantId)
    .eq("location_id", locationId);

  if (error) throw error;

  const locationLabel =
    code === "MAIN" ? "Main Store" : code === "QUAR" ? "Quarantine" : "Rejected Material";

  return (data ?? [])
    .map((row: any) => ({
      id: row.id,
      plant_id: row.plant_id,
      raw_material_id: row.raw_material_id,
      location_id: row.location_id,
      quantity: Number(row.quantity) || 0,
      minimum_stock: row.min_stock == null ? 0 : Number(row.min_stock),
      location: locationLabel,
      last_updated: row.updated_at,
      raw_materials: row.raw_materials,
    }))
    .sort((a: any, b: any) =>
      (a.raw_materials?.material_code || "").localeCompare(
        b.raw_materials?.material_code || ""
      )
    );
}

/** Current balance of one material at one location. */
export async function fetchStockQuantity(
  plantId: string,
  rawMaterialId: string,
  code: StockLocationCode = "MAIN"
): Promise<number> {
  const locationId = await getStockLocationId(plantId, code);
  const { data, error } = await supabase
    .from("stock_balance")
    .select("quantity")
    .eq("plant_id", plantId)
    .eq("raw_material_id", rawMaterialId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.quantity ?? 0);
}
