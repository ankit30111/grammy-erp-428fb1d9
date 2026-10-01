import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIT_OPTIONS, unitFactor } from "@/lib/units";

/**
 * How a part is bought and how it is consumed.
 *
 *   Purchased in      the unit on the vendor's bill and the PO (KG, ROLL, MM...)
 *   Consumed in a different unit  [tick]  only for parts that are used in
 *                     another unit than they are bought in: 1 KG = 250 PCS.
 *
 * The consumed unit (or the purchased unit when the box is not ticked) is the
 * part's one unit for stock, every BOM, kits and issues. It is never chosen per
 * BOM. In the database: parts.uom = consumed unit, purchase_uom + purchase_factor
 * = purchased unit and how many consumed units one of it is.
 */
export interface UnitValue {
  purchased: string;
  different: boolean;
  consumed: string;
  factor: string;
}

export const unitValueFromPart = (p?: { uom?: string | null; purchase_uom?: string | null; purchase_factor?: number | string | null } | null): UnitValue => {
  const u = (p?.uom || "PCS").toUpperCase();
  const pu = (p?.purchase_uom || "").toUpperCase();
  return pu && pu !== u
    ? { purchased: pu, different: true, consumed: u, factor: String(p?.purchase_factor ?? 1) }
    : { purchased: u, different: false, consumed: u, factor: "1" };
};

/** The three part columns this value stands for. */
export const unitColumns = (v: UnitValue) =>
  v.different && v.consumed && v.consumed !== v.purchased
    ? { uom: v.consumed, purchase_uom: v.purchased, purchase_factor: Number(v.factor) || 1 }
    : { uom: v.purchased || "PCS", purchase_uom: null as string | null, purchase_factor: 1 };

/** A message when the value cannot be saved, otherwise null. */
export const unitProblem = (v: UnitValue): string | null =>
  v.different && v.consumed !== v.purchased && !(Number(v.factor) > 0)
    ? `Enter how many ${v.consumed} one ${v.purchased} is`
    : null;

export function PartUnitFields({ value, onChange, idPrefix = "unit" }: {
  value: UnitValue;
  onChange: (v: UnitValue) => void;
  idPrefix?: string;
}) {
  const set = (patch: Partial<UnitValue>) => {
    const next = { ...value, ...patch };
    // Related units fill their own factor (1 KG = 1000 GRAM, 1 METER = 1000 MM).
    if ((patch.consumed || patch.purchased || patch.different) && next.different) {
      const f = unitFactor(next.purchased, next.consumed);
      if (f !== null) next.factor = String(f);
    }
    onChange(next);
  };
  const shown = value.different ? value.consumed : value.purchased;

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-purchased`}>Purchased in</Label>
          <Select value={value.purchased} onValueChange={(v) => set({ purchased: v, ...(value.different ? {} : { consumed: v }) })}>
            <SelectTrigger id={`${idPrefix}-purchased`}><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer sm:mt-8">
          <Checkbox
            id={`${idPrefix}-different`}
            checked={value.different}
            onCheckedChange={(c) => set({ different: Boolean(c), consumed: Boolean(c) ? (value.consumed !== value.purchased ? value.consumed : "PCS") : value.purchased })}
          />
          Consumed in a different unit
        </label>
      </div>

      {value.different && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
          <Label htmlFor={`${idPrefix}-consumed`} className="mr-1">Consumed in</Label>
          <Select value={value.consumed} onValueChange={(v) => set({ consumed: v })}>
            <SelectTrigger id={`${idPrefix}-consumed`} className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.filter((u) => u !== value.purchased).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm ml-2">1 {value.purchased} =</span>
          <Input
            id={`${idPrefix}-factor`}
            type="number" min="0" step="any" className="w-28"
            value={value.factor}
            onChange={(e) => onChange({ ...value, factor: e.target.value })}
          />
          <span className="text-sm">{value.consumed}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Stock and every bill of materials use <b>{shown}</b>.
        {value.different && <> GRNs and POs can be entered in {value.purchased}; they are converted at 1 {value.purchased} = {value.factor || "?"} {value.consumed}.</>}
      </p>
    </div>
  );
}
