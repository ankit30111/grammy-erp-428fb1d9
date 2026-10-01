/**
 * Units of measure.
 *
 * A part's `uom` is its stock unit: stock, BOM quantities, kits and issues are
 * always in it. Anything entered in another unit is converted into it:
 *   - related units: MM <-> METER, GRAM <-> KG  (same as the database's unit_factor())
 *   - the part's purchase unit: 1 purchase_uom = purchase_factor x uom
 *     (bought in KG, used in PCS: 1 KG = 250 PCS)
 */

export const UNIT_OPTIONS = ["PCS", "MM", "METER", "GRAM", "KG", "LITER", "SET", "PACK", "ROLL", "SHEET", "BOX"];

const RELATED: Record<string, { family: string; base: number }> = {
  MM: { family: "length", base: 1 },
  METER: { family: "length", base: 1000 },
  GRAM: { family: "mass", base: 1 },
  KG: { family: "mass", base: 1000 },
};

/** How many `to` make one `from` (MM -> METER = 0.001), or null if unrelated. */
export function unitFactor(from: string, to: string): number | null {
  const f = (from || "PCS").toUpperCase(), t = (to || "PCS").toUpperCase();
  if (f === t) return 1;
  const a = RELATED[f], b = RELATED[t];
  return a && b && a.family === b.family ? a.base / b.base : null;
}

export interface UnitPart {
  uom?: string | null;
  purchase_uom?: string | null;
  purchase_factor?: number | string | null;
}

export interface EntryUnit {
  unit: string;
  /** stock units in one of this unit */
  toStock: number;
  /** shown next to the choice, e.g. "1 ROLL = 22000 MM" */
  hint?: string;
}

/** The units a quantity of this part can be entered in, stock unit first. */
export function entryUnitsFor(part: UnitPart): EntryUnit[] {
  const stock = (part.uom || "PCS").toUpperCase();
  const out: EntryUnit[] = [{ unit: stock, toStock: 1 }];
  for (const u of Object.keys(RELATED)) {
    const f = unitFactor(u, stock);
    if (u !== stock && f !== null) out.push({ unit: u, toStock: f, hint: `1 ${u} = ${fmtQty(f)} ${stock}` });
  }
  const pu = (part.purchase_uom || "").toUpperCase();
  const pf = Number(part.purchase_factor || 1);
  if (pu && pu !== stock && pf > 0 && !out.some((e) => e.unit === pu)) {
    out.push({ unit: pu, toStock: pf, hint: `1 ${pu} = ${fmtQty(pf)} ${stock}` });
  }
  return out;
}

/** A quantity in `unit`, converted into the part's stock unit. */
export function toStockQty(qty: number, unit: string, part: UnitPart): number {
  const e = entryUnitsFor(part).find((x) => x.unit === (unit || "").toUpperCase());
  return round(qty * (e?.toStock ?? 1));
}

/** A stock-unit quantity, shown in `unit`. */
export function fromStockQty(qty: number, unit: string, part: UnitPart): number {
  const e = entryUnitsFor(part).find((x) => x.unit === (unit || "").toUpperCase());
  return round(qty / (e?.toStock ?? 1));
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export const fmtQty = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : Number(n.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 });
