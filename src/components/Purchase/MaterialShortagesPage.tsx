import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton, TableEmpty } from "@/components/ui/table-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useShortages, ShortageRow } from "@/hooks/useShortages";
import { usePlantId } from "@/hooks/usePlantId";
import MaterialShortageDetails from "./MaterialShortageDetails";

const num = (v: number) => (v ? v.toLocaleString("en-IN") : "—");
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "—");

/**
 * The shortage list. Worked out in the database every time it is read, so
 * everyone sees the same figures; it re-reads itself every 30 seconds.
 */
export const MaterialShortagesPage = () => {
  const plantId = usePlantId();
  const { data: shortages = [], isLoading, dataUpdatedAt } = useShortages(plantId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ShortageRow | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return shortages;
    return shortages.filter(
      (row) =>
        row.part_code.toLowerCase().includes(term) ||
        row.name.toLowerCase().includes(term) ||
        (row.vendor_name || "").toLowerCase().includes(term),
    );
  }, [shortages, search]);

  const toOrder = rows.filter((row) => row.to_order > 0).length;
  const onOrder = rows.filter((row) => row.status === "ON_ORDER").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by part code, name or vendor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={toOrder > 0 ? "destructive" : "secondary"}>{toOrder} to order</Badge>
          <Badge variant="outline">{onOrder} covered by POs placed</Badge>
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Live · read at {new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right" title="What open vouchers still need from the store">Still to issue</TableHead>
                  <TableHead className="text-right" title="Demand of projections that are not on a voucher yet">Not yet on a voucher</TableHead>
                  <TableHead className="text-right">In store</TableHead>
                  <TableHead className="text-right" title="Received, waiting for incoming inspection">At IQC</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                  <TableHead className="text-right" title="On purchase orders already approved, not yet received">On order</TableHead>
                  <TableHead className="text-right">To order</TableHead>
                  <TableHead>Needed on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={10} />
                ) : rows.length === 0 ? (
                  <TableEmpty
                    columns={10}
                    message="Nothing is short"
                    hint="Shortages come from open vouchers and from projections that are not on a voucher yet. Add a projection first."
                  />
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.part_id} className="cursor-pointer" onClick={() => setSelected(row)}>
                      <TableCell>
                        <span className="font-mono font-medium">{row.part_code}</span>{" "}
                        <span className="text-muted-foreground">{row.name}</span>
                      </TableCell>
                      <TableCell className="text-sm">{row.vendor_name || <span className="text-destructive">No vendor</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(row.hold)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(row.required)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(row.available)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(row.at_iqc)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{num(row.shortage)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.on_order ? num(row.on_order) : row.pending_pos.length ? <span className="text-xs text-muted-foreground">PO not approved</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.to_order > 0 ? <Badge variant="destructive">{num(row.to_order)}</Badge>
                          : row.shortage > 0 ? <Badge variant="secondary">On order</Badge>
                          : <Badge variant="outline">Covered</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(row.needed_on)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MaterialShortageDetails shortage={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default MaterialShortagesPage;
