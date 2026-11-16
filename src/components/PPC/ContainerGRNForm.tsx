import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, stageIndex, useImportContainers } from "@/hooks/useImports";

const num = (v: number) => Number(v || 0).toLocaleString("en-IN");
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * GRN from a container's packing list. The lines come from what was loaded;
 * the store enters the quantity on the documents, and one action creates the
 * GRN (one per PO in the container), puts the stock into quarantine and marks
 * the container as at the factory.
 */
export function ContainerGRNForm() {
  const qc = useQueryClient();
  const { data: containers = [], isLoading } = useImportContainers();
  const [containerId, setContainerId] = useState("");
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState<Record<string, string>>({});

  // Containers that still have lines not received on a GRN.
  const open = useMemo(() => containers.filter((c) => c.lines.some((l) => !l.grn_item_id)), [containers]);
  const container = open.find((c) => c.id === containerId) ?? null;
  const lines = (container?.lines ?? []).filter((l) => !l.grn_item_id);
  const value = (id: string, packed: number) => qty[id] ?? String(packed);
  const receiving = lines.filter((l) => Number(value(l.id, l.quantity)) > 0);
  const poCount = new Set(receiving.map((l) => l.po_item?.purchase_order?.id)).size;

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("grn_from_container", {
        p_container: containerId, p_received_date: date,
        p_lines: lines.map((l) => ({ line_id: l.id, quantity: Number(value(l.id, l.quantity)) || 0 })),
      });
      if (error) throw error;
      return data as { grn_numbers: string[]; lines: number };
    },
    onSuccess: (d) => {
      toast.success(`${d.grn_numbers.join(", ")} created. ${d.lines} line(s) are waiting for IQC.`);
      setContainerId(""); setQty({});
      qc.invalidateQueries({ predicate: (q) => /^(import-|grn|purchase|stock|shortages)/.test(String(q.queryKey[0] ?? "")) });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the GRN"),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-1">
            <Label htmlFor="grn-container">Container</Label>
            <Select value={containerId} onValueChange={(v) => { setContainerId(v); setQty({}); }}>
              <SelectTrigger id="grn-container"><SelectValue placeholder={isLoading ? "Loading…" : open.length ? "Choose a container" : "No container is waiting to be received"} /></SelectTrigger>
              <SelectContent>
                {open.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.container_number} · {STAGES[stageIndex(c.current_status)].label}
                    {c.shipping_line ? ` · ${c.shipping_line}` : ""} · {c.lines.filter((l) => !l.grn_item_id).length} line(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="grn-container-date">Received on</Label>
            <Input id="grn-container-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {container && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead><TableHead>Part</TableHead><TableHead className="text-right">On the packing list</TableHead>
                    <TableHead className="w-40 text-right">Received as per documents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="font-mono">{l.po_item?.purchase_order?.po_number ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{l.po_item?.purchase_order?.vendor?.name ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-sm"><span className="font-mono">{l.part?.part_code}</span> <span className="text-muted-foreground">{l.part?.name}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.quantity)} <span className="text-xs text-muted-foreground">{l.part?.uom ?? ""}</span></TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} step="any" className="h-8 text-right tabular-nums" aria-label={`Received quantity of ${l.part?.part_code}`}
                               value={value(l.id, l.quantity)} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Enter 0 for a line that did not arrive; it stays open on the container. Creates {poCount} GRN{poCount === 1 ? "" : "s"} (one per PO),
                puts the material into quarantine for IQC, and marks the container as at the factory.
              </p>
              <Button disabled={!receiving.length || !date || create.isPending} onClick={() => create.mutate()}>
                <PackageCheck className="mr-2 h-4 w-4" /> {create.isPending ? "Creating…" : "Create GRN"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
