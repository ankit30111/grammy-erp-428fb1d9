import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PendingReturn, useReturnMutations, useReturns, VERDICT } from "@/hooks/useReturns";

const num = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const where = (r: PendingReturn) => (r.verdict === "USABLE" ? "Main store" : "Reject store");

/** Returns from production: the store counts each one; that count is what returns to stock. */
export default function ReturnsTab() {
  const { data, isLoading } = useReturns();
  const m = useReturnMutations();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const waiting = data?.waiting ?? [], done = data?.done ?? [];

  const cells = (r: PendingReturn) => (
    <>
      <TableCell className="whitespace-nowrap text-sm">
        <div className="font-mono">{r.kit_item?.kit?.order?.voucher_number ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{r.kit_item?.kit?.order?.part?.part_code ?? ""}</div>
      </TableCell>
      <TableCell className="text-sm"><span className="font-mono">{r.kit_item?.part?.part_code}</span> <span className="text-muted-foreground">{r.kit_item?.part?.name}</span></TableCell>
      <TableCell><Badge variant={r.verdict === "USABLE" ? "secondary" : "destructive"}>{VERDICT[r.verdict]}</Badge><div className="mt-0.5 text-xs text-muted-foreground">to {where(r).toLowerCase()}</div></TableCell>
      <TableCell className="text-right tabular-nums">{num(r.quantity)} <span className="text-xs text-muted-foreground">{r.kit_item?.part?.uom ?? ""}</span></TableCell>
    </>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Waiting to be counted</h2>
            <p className="text-xs text-muted-foreground">Count what actually came back and confirm. Your count is final, and only that quantity returns to stock.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher</TableHead><TableHead>Part</TableHead><TableHead>Condition</TableHead>
                  <TableHead className="text-right">Production sent</TableHead><TableHead className="w-32 text-right">Counted</TableHead><TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                  : !waiting.length ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nothing is waiting.</TableCell></TableRow>
                  : waiting.map((r) => {
                    const v = counted[r.id] ?? String(r.quantity);
                    return (
                      <TableRow key={r.id}>
                        {cells(r)}
                        <TableCell>
                          <Input type="number" min={0} step="any" className="h-8 text-right tabular-nums" aria-label={`Counted quantity of ${r.kit_item?.part?.part_code}`}
                                 value={v} onChange={(e) => setCounted({ ...counted, [r.id]: e.target.value })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={v === "" || Number(v) < 0 || m.confirm.isPending} onClick={() => m.confirm.mutate({ id: r.id, counted: Number(v) })}>Confirm</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Counted</h2></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher</TableHead><TableHead>Part</TableHead><TableHead>Condition</TableHead>
                    <TableHead className="text-right">Production sent</TableHead><TableHead className="text-right">Store counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead><TableHead>Counted on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {done.map((r) => {
                    const diff = Number(r.counted_quantity ?? 0) - Number(r.quantity);
                    return (
                      <TableRow key={r.id}>
                        {cells(r)}
                        <TableCell className="text-right tabular-nums">{num(r.counted_quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{diff === 0 ? "—" : <span className="text-destructive">{diff > 0 ? "+" : ""}{num(diff)}</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.verified_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
