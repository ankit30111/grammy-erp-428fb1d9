import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { useBomLines } from "@/hooks/useBOM";
import { cn } from "@/lib/utils";

/**
 * What is inside a sub-assembly, as rows under its line in any BOM table.
 *
 * A sub-assembly (top panel, LED assembly, battery pack) is only a way of
 * building the product in stages; its parts are still the product's parts.
 * So wherever a product's BOM is shown, a sub-assembly line opens to show its
 * own BOM, level by level, with the quantity in the sub-assembly and the
 * quantity that ends up in one product.
 */

type Line = { child_part_id: string; quantity: number | null; issue_mode: string; is_critical: boolean;
  child: { id: string; part_code: string; name: string; uom: string | null; source_type: string } | null };

/** Parts that have a BOM of their own (sub-assemblies, battery packs...). */
export const useHasInside = () => {
  const { data: lines = [] } = useBomLines();
  return useMemo(() => {
    const by = new Map<string, Line[]>();
    for (const l of lines as any[]) {
      const arr = by.get(l.parent_part_id) ?? [];
      arr.push(l);
      by.set(l.parent_part_id, arr);
    }
    for (const arr of by.values()) arr.sort((a, b) => String(a.child?.part_code).localeCompare(String(b.child?.part_code)));
    return by;
  }, [lines]);
};

const fmt = (n: number) => (Math.round(n * 10000) / 10000).toString();

/** The toggle shown on a line whose part has parts inside. */
export function InsideToggle({ partId, open, onToggle, inside }: {
  partId: string; open: boolean; onToggle: () => void; inside: Map<string, Line[]>;
}) {
  const n = inside.get(partId)?.length ?? 0;
  if (!n) return null;
  return (
    <button type="button" onClick={onToggle}
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      {open ? "Hide" : "Show"} {n} part{n === 1 ? "" : "s"} inside
    </button>
  );
}

/**
 * Rows for everything inside `partId`. `lead` empty cells come first (to line
 * up under the part column), then the part, its QPS in the sub-assembly, and
 * one cell spanning `rest` columns with the quantity per product.
 */
export function SubAssemblyRows({ partId, perProduct, inside, lead = 0, rest, depth = 1, partSpan = 1 }: {
  partId: string; perProduct: number | null; inside: Map<string, Line[]>; lead?: number; rest: number; depth?: number; partSpan?: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = inside.get(partId) ?? [];
  return (
    <>
      {rows.map((l) => {
        const bulk = l.issue_mode === "BULK";
        const qty = bulk ? null : Number(l.quantity ?? 0);
        const each = perProduct != null && qty != null ? perProduct * qty : null;
        const uom = (l.child?.uom ?? "PCS").toUpperCase();
        const hasInside = (inside.get(l.child_part_id)?.length ?? 0) > 0;
        return (
          <Fragment key={`${partId}-${l.child_part_id}`}>
            <TableRow className="bg-muted/30 text-sm">
              {Array.from({ length: lead }).map((_, i) => <TableCell key={i} className="py-1.5" />)}
              <TableCell className="py-1.5" colSpan={partSpan}>
                <div style={{ paddingLeft: depth * 20 }} className="border-l-2 border-primary/30 pl-2">
                  <span className="font-mono text-xs">{l.child?.part_code}</span> <span>{l.child?.name}</span>
                  {l.is_critical && <span className="ml-1 text-[10px] font-semibold uppercase text-destructive">critical</span>}
                  {hasInside && (
                    <div>
                      <InsideToggle partId={l.child_part_id} inside={inside} open={!!open[l.child_part_id]}
                                    onToggle={() => setOpen((o) => ({ ...o, [l.child_part_id]: !o[l.child_part_id] }))} />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-right tabular-nums whitespace-nowrap">
                {bulk ? "bulk" : `${fmt(qty!)} ${uom}`}
                <div className="text-[10px] text-muted-foreground">in the sub-assembly</div>
              </TableCell>
              <TableCell colSpan={rest} className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                {bulk ? "issued in bulk" : each != null ? `${fmt(each)} ${uom} per product` : ""}
              </TableCell>
            </TableRow>
            {hasInside && open[l.child_part_id] && (
              <SubAssemblyRows partId={l.child_part_id} perProduct={each} inside={inside} lead={lead} rest={rest} depth={depth + 1} partSpan={partSpan} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** Small helper for tables that keep their own open/closed state per line. */
export const useOpenSet = () => {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return { isOpen: (id: string) => !!open[id], toggle: (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] })), cn };
};
