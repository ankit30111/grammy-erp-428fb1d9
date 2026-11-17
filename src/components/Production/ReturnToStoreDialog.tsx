import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReturnLines, useReturnMutations, Verdict, VERDICT } from "@/hooks/useReturns";

const num = (v: number | null) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));

/**
 * Send material left on the line back to the store.
 * "Should come back" = issued - already returned - (BOM quantity x sets made).
 */
export function ReturnToStoreDialog({ order, onClose }: {
  order: { id: string; voucher_number: string; quantity: number }; onClose: () => void;
}) {
  const { data: lines = [], isLoading } = useReturnLines(order.id);
  const m = useReturnMutations();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<Record<string, Verdict>>({});

  // Start with what the sum says should come back.
  useEffect(() => {
    const start: Record<string, string> = {};
    for (const l of lines) if (l.expected_back) start[l.kit_item_id] = String(l.expected_back);
    setQty(start);
  }, [lines]);

  const produced = lines[0]?.produced ?? 0;
  const sending = lines.filter((l) => Number(qty[l.kit_item_id]) > 0);
  const tooMuch = sending.find((l) => Number(qty[l.kit_item_id]) > l.issued - l.returned - l.waiting);

  const send = () => m.raise.mutate({
    orderId: order.id,
    lines: sending.map((l) => ({ kit_item_id: l.kit_item_id, quantity: Number(qty[l.kit_item_id]), verdict: verdict[l.kit_item_id] ?? "USABLE", notes: "" })),
  }, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,980px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return material to the store · <span className="font-mono">{order.voucher_number}</span></DialogTitle>
          <DialogDescription>
            Voucher for {num(order.quantity)}, {num(produced)} made. Enter what is going back; the store counts it and their count is final.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead><TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right" title="BOM quantity x sets made">Used</TableHead>
                <TableHead className="text-right">Already back</TableHead><TableHead className="text-right">Should come back</TableHead>
                <TableHead className="w-28 text-right">Sending back</TableHead><TableHead className="w-32">Condition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                : !lines.length ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nothing has been issued to this voucher.</TableCell></TableRow>
                : lines.map((l) => {
                  const q = Number(qty[l.kit_item_id] ?? 0), max = l.issued - l.returned - l.waiting;
                  return (
                    <TableRow key={l.kit_item_id}>
                      <TableCell className="text-sm">
                        <span className="font-mono">{l.part_code}</span> <span className="text-muted-foreground">{l.part_name}</span>
                        {l.rejected > 0 && <div className="text-xs text-muted-foreground">{num(l.rejected)} rejected on the line</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.issued)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.per_set == null ? "—" : num(l.per_set * l.produced)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(l.returned)}{l.waiting > 0 && <div className="text-xs text-muted-foreground">+{num(l.waiting)} at the store</div>}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{num(l.expected_back)}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={max} step="any" disabled={max <= 0} aria-label={`Quantity of ${l.part_code} going back`}
                               className={`h-8 text-right tabular-nums ${q > max ? "border-destructive" : ""}`}
                               value={qty[l.kit_item_id] ?? ""} onChange={(e) => setQty({ ...qty, [l.kit_item_id]: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Select value={verdict[l.kit_item_id] ?? "USABLE"} onValueChange={(v) => setVerdict({ ...verdict, [l.kit_item_id]: v as Verdict })} disabled={!(q > 0)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(VERDICT) as Verdict[]).map((v) => <SelectItem key={v} value={v}>{VERDICT[v]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
        {tooMuch && <p className="text-sm text-destructive">{tooMuch.part_code}: at most {num(tooMuch.issued - tooMuch.returned - tooMuch.waiting)} can come back.</p>}
        <p className="text-xs text-muted-foreground">Usable goes back to the main store. Faulty and damaged go to the reject store. To send one part back in two conditions, send it twice.</p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={!sending.length || !!tooMuch || m.raise.isPending} onClick={send}>Send {sending.length || ""} line(s) to the store</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
