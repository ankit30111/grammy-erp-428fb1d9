import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { COMPLAINT_STATUS, ageDays, causeLabel, fmtDate, useComplaints, useComplaintReceipts, receiptTypeLabel } from "@/hooks/useComplaints";
import { cn } from "@/lib/utils";
import { ComplaintDialog } from "./ComplaintDialog";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/**
 * Every complaint, one row per unit. Open ones first; a row opens the
 * complaint, where OQC analyses it, sends parts to IQC and closes it.
 */
export function ComplaintsList({ receiptId }: { receiptId?: string }) {
  const { data = [], isLoading } = useComplaints();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(receiptId ? "" : "OPEN_ALL");
  const [customer, setCustomer] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const customers = useMemo(() => [...new Map(data.map((c: any) => [c.customer?.id, c.customer])).values()].filter(Boolean)
    .sort((a: any, b: any) => a.customer_code.localeCompare(b.customer_code, "en", { numeric: true })), [data]);

  const rows = data.filter((c: any) => {
    if (receiptId && c.receipt_id !== receiptId) return false;
    if (status === "OPEN_ALL" ? c.status === "CLOSED" : status && c.status !== status) return false;
    if (customer && c.customer?.id !== customer) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      return [c.complaint_number, c.serial_number, c.product?.part_code, c.product?.name, c.customer?.name, c.receipt?.receipt_number, c.receipt?.customer_reference, c.complaint_details]
        .some((x) => String(x ?? "").toLowerCase().includes(s));
    }
    return true;
  });
  const counts = data.reduce((m: Record<string, number>, c: any) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {});

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 w-64" placeholder="Search no., serial, product, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN_ALL">All open</option>
            {Object.entries(COMPLAINT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] ?? 0})</option>)}
            <option value="">Everything</option>
          </select>
          <select className={sel} value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">All customers</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{rows.length} complaint{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Complaint / finding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={7} rows={4} />
                : !rows.length ? <TableEmpty columns={7} message="No complaints here" hint="Receive one on the Receive tab." />
                : rows.map((c: any) => {
                  const st = COMPLAINT_STATUS[c.status] ?? { label: c.status, tone: "outline" as const };
                  const atIqc = (c.parts ?? []).filter((p: any) => p.status !== "CLOSED").length;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-mono text-sm">{c.complaint_number}</div>
                        <div className="text-xs text-muted-foreground">{c.receipt?.receipt_number ?? "—"} · {fmtDate(c.received_date)}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.customer?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="font-mono">{c.product?.part_code}</span>
                        {c.faulty && <div className="text-xs text-muted-foreground">part {c.faulty.part_code}</div>}
                      </TableCell>
                      <TableCell className={cn("font-mono text-sm", !c.serial_number && "text-muted-foreground")}>{c.serial_number ?? "—"}</TableCell>
                      <TableCell className="max-w-[22rem] text-sm">
                        <div className="truncate">{c.complaint_details}</div>
                        {c.cause && <div className="truncate text-xs text-muted-foreground">{causeLabel(c.cause)}{c.analysis ? ` · ${c.analysis}` : ""}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={st.tone}>{st.label}</Badge>
                        {atIqc > 0 && c.status !== "PARTS_SENT" && <div className="text-xs text-muted-foreground">{atIqc} part(s) at IQC</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.status === "CLOSED" ? "" : ageDays(c.received_date)}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {openId && <ComplaintDialog id={openId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

/** The receipts: what came in together, and how far its complaints are. */
export function ComplaintReceiptsList() {
  const { data = [], isLoading } = useComplaintReceipts();
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h3 className="text-sm font-semibold">Recent receipts</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Complaints</TableHead>
                <TableHead className="text-right">Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={6} rows={3} />
                : !data.length ? <TableEmpty columns={6} message="No receipts yet" />
                : data.map((r: any) => {
                  const n = r.complaints?.length ?? 0;
                  const closed = (r.complaints ?? []).filter((c: any) => c.status === "CLOSED").length;
                  const codes = (r.items ?? []).map((i: any) => `${i.part?.part_code} × ${i.quantity}`).join(", ");
                  return (
                    <TableRow key={r.id} className={cn("cursor-pointer", openReceipt === r.id && "bg-muted/60")}
                              onClick={() => setOpenReceipt(openReceipt === r.id ? null : r.id)}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-mono text-sm">{r.receipt_number}</div>
                        <div className="text-xs text-muted-foreground">{receiptTypeLabel(r.receipt_type)}{r.customer_reference ? ` · ${r.customer_reference}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.customer?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.receipt_date)}</TableCell>
                      <TableCell className="max-w-[20rem] truncate font-mono text-sm">{codes}</TableCell>
                      <TableCell className="text-right tabular-nums">{n}</TableCell>
                      <TableCell className="text-right tabular-nums">{closed}/{n}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
        {openReceipt && <ComplaintsList receiptId={openReceipt} />}
      </CardContent>
    </Card>
  );
}
