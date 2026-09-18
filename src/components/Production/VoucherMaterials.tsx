import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package } from "lucide-react";

/**
 * Material requirements for one production voucher.
 *
 * Five columns, which is what Ankit asked for and what the netting model needs:
 *
 *   Required        BOM quantity x voucher quantity
 *   Available       physical stock in the MAIN store
 *   Held            reserved by OTHER vouchers (this voucher's own hold is excluded,
 *                   or it would appear to be competing with itself)
 *   Free            available minus held - what this voucher can actually draw
 *   Balance         free minus required; negative is the real shortage
 *
 * The old version grouped by bom.bom_type into Main / Sub / Accessory. That column
 * no longer exists, so all three buckets read "No items in this category" while the
 * header said 54 BOM items - the screen contradicted itself. The grouping is gone
 * rather than resurrected: with a recursive BOM the meaningful distinction is
 * whether a child is purchased or assembled, and that is on parts.source_type.
 * Assembled children are marked in the table instead of split into sections.
 */

export interface VoucherMaterialRow {
  partId: string;
  partCode: string;
  partName: string;
  uom: string;
  sourceType: string;
  perUnit: number;
  required: number;
  available: number;
  held: number;
  free: number;
  balance: number;
}

export function useVoucherMaterials(
  partId: string | undefined,
  quantity: number,
  plantId: string | undefined,
  productionOrderId?: string
) {
  return useQuery({
    queryKey: ["voucher-materials", partId, quantity, plantId, productionOrderId],
    enabled: !!partId && !!plantId && quantity > 0,
    queryFn: async (): Promise<VoucherMaterialRow[]> => {
      const { data: bom, error: bomError } = await supabase
        .from("bom")
        .select(`
          quantity,
          uom,
          child_part_id,
          parts:child_part_id (part_code, name, uom, source_type)
        `)
        .eq("parent_part_id", partId!)
        .eq("is_active", true);
      if (bomError) throw bomError;
      if (!bom?.length) return [];

      const partIds = bom.map((b: any) => b.child_part_id);

      // Physical stock in the main store only. Quarantine and reject are not usable.
      const { data: balances, error: balError } = await supabase
        .from("stock_balance")
        .select("part_id, quantity, stock_locations!inner(code)")
        .eq("plant_id", plantId!)
        .eq("stock_locations.code", "MAIN")
        .in("part_id", partIds);
      if (balError) throw balError;

      // Active holds from other vouchers. A voucher does not block itself.
      let holdQuery = supabase
        .from("stock_holds")
        .select("part_id, quantity, production_order_id")
        .eq("plant_id", plantId!)
        .eq("status", "ACTIVE")
        .in("part_id", partIds);
      if (productionOrderId) {
        holdQuery = holdQuery.neq("production_order_id", productionOrderId);
      }
      const { data: holds, error: holdError } = await holdQuery;
      if (holdError) throw holdError;

      const availableBy = new Map<string, number>();
      (balances ?? []).forEach((b: any) =>
        availableBy.set(b.part_id, (availableBy.get(b.part_id) ?? 0) + Number(b.quantity ?? 0))
      );
      const heldBy = new Map<string, number>();
      (holds ?? []).forEach((h: any) =>
        heldBy.set(h.part_id, (heldBy.get(h.part_id) ?? 0) + Number(h.quantity ?? 0))
      );

      return bom
        .map((b: any): VoucherMaterialRow => {
          const perUnit = Number(b.quantity);
          const required = perUnit * quantity;
          const available = availableBy.get(b.child_part_id) ?? 0;
          const held = heldBy.get(b.child_part_id) ?? 0;
          const free = available - held;
          return {
            partId: b.child_part_id,
            partCode: b.parts?.part_code ?? "—",
            partName: b.parts?.name ?? "—",
            uom: b.uom ?? b.parts?.uom ?? "",
            sourceType: b.parts?.source_type ?? "PURCHASED",
            perUnit,
            required,
            available,
            held,
            free,
            balance: free - required,
          };
        })
        .sort((a, b) => a.partCode.localeCompare(b.partCode));
    },
  });
}

/** Trailing zeros are noise on whole numbers, but 0.0033 must not round to 0. */
const fmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : Number(n.toFixed(4)).toLocaleString();

export function VoucherMaterials({
  partId,
  quantity,
  plantId,
  productionOrderId,
  onRefresh,
}: {
  partId?: string;
  quantity: number;
  plantId?: string;
  productionOrderId?: string;
  onRefresh?: () => void;
}) {
  const { data: rows = [], isLoading, refetch } = useVoucherMaterials(
    partId,
    quantity,
    plantId,
    productionOrderId
  );

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Loading materials…</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-10 text-center">
        <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No BOM lines for this product</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add a BOM before scheduling production against it.
        </p>
      </div>
    );
  }

  const short = rows.filter((r) => r.balance < 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} material{rows.length === 1 ? "" : "s"}
          {short.length > 0 && (
            <span className="ml-2 text-destructive font-medium">
              · {short.length} short
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            refetch();
            onRefresh?.();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Code</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Per Unit</TableHead>
              <TableHead className="text-right">Required</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Held</TableHead>
              <TableHead className="text-right">Free</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.partId}>
                <TableCell className="font-mono font-medium whitespace-nowrap">
                  {r.partCode}
                </TableCell>
                <TableCell>
                  {r.partName}
                  {r.sourceType !== "PURCHASED" && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {r.sourceType === "ASSEMBLED_INLINE" ? "in-line" : "assembled"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {fmt(r.perUnit)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {fmt(r.required)}
                </TableCell>
                <TableCell className="text-right font-mono">{fmt(r.available)}</TableCell>
                <TableCell className="text-right font-mono text-amber-600">
                  {r.held > 0 ? fmt(r.held) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">{fmt(r.free)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {r.balance < 0 ? (
                    <span className="text-destructive">{fmt(r.balance)}</span>
                  ) : (
                    <span className="text-green-600">{fmt(r.balance)}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Available is physical stock in the main store. Held is reserved by other
        production vouchers — this voucher's own hold is excluded. Free is what this
        voucher can draw on, and Balance is Free minus Required.
      </p>
    </div>
  );
}
