import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, TableEmpty } from "@/components/ui/table-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useShortages, useRefreshShortages, ShortageRow } from "@/hooks/useShortages";
import { usePlantId } from "@/hooks/usePlantId";
import MaterialShortageDetails from "./MaterialShortageDetails";

export const MaterialShortagesPage = () => {
  const plantId = usePlantId();
  const { data: shortages = [], isLoading } = useShortages(plantId);
  const refresh = useRefreshShortages();
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

  const shortCount = rows.filter((row) => row.shortage > 0).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by part code, name or vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={shortCount > 0 ? "destructive" : "secondary"}>
                {shortCount} part(s) short
              </Badge>
              <Button
                variant="outline"
                onClick={() => plantId && refresh.mutate(plantId)}
                disabled={!plantId || refresh.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refresh.isPending ? "animate-spin" : ""}`} />
                Refresh shortage list
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Material Shortages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S.No.</TableHead>
                <TableHead>Part Code</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Hold</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Needed On</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton columns={10} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  columns={10}
                  message="Nothing is short"
                  hint="Shortages are worked out from projections and the bill of materials. Add a projection first."
                />
              ) : (
                rows.map((row, index) => (
                  <TableRow
                    key={row.part_id}
                    className="cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                    <TableCell className="font-mono font-medium">{row.part_code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.vendor_name || "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.required.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{row.available.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{row.hold.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">
                      <Badge variant={row.balance < 0 ? "destructive" : "secondary"}>
                        {row.balance.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.needed_on || "—"}</TableCell>
                    <TableCell>
                      {row.purchase_order_item_id ? (
                        <Badge variant="secondary">PO raised</Badge>
                      ) : row.shortage > 0 ? (
                        <Badge variant="destructive">Short</Badge>
                      ) : (
                        <Badge>Covered by stock</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MaterialShortageDetails
        shortage={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default MaterialShortagesPage;
