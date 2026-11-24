import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { COMPLAINT_STATUS, VERDICTS, ageDays, causeLabel, fmtDate, useComplaints, useComplaintReceipts, receiptTypeLabel } from "@/hooks/useComplaints";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ddmmyyyy, downloadBytes, writeWorkbook } from "@/lib/xlsxLite";
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
  const [product, setProduct] = useState("");
  const [part, setPart] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const byCode = (a: any, b: any) => String(a.part_code).localeCompare(String(b.part_code), "en", { numeric: true });
  const customers = useMemo(() => [...new Map(data.map((c: any) => [c.customer?.id, c.customer])).values()].filter(Boolean)
    .sort((a: any, b: any) => a.customer_code.localeCompare(b.customer_code, "en", { numeric: true })), [data]);
  const products = useMemo(() => [...new Map(data.map((c: any) => [c.product?.id, c.product])).values()].filter(Boolean).sort(byCode), [data]);
  // A part is the faulty part received, or any part OQC sent on to IQC.
  const partsOf = (c: any) => [c.faulty, ...(c.parts ?? []).map((p: any) => p.part)].filter(Boolean);
  const parts = useMemo(() => [...new Map(data.flatMap((c: any) => partsOf(c).map((p: any) => [p.id, p]))).values()].sort(byCode), [data]);

  const rows = data.filter((c: any) => {
    if (receiptId && c.receipt_id !== receiptId) return false;
    if (status === "OPEN_ALL" ? c.status === "CLOSED" : status && c.status !== status) return false;
    if (customer && c.customer?.id !== customer) return false;
    if (product && c.product?.id !== product) return false;
    if (part && !partsOf(c).some((p: any) => p.id === part)) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      return [c.complaint_number, c.serial_number, c.product?.part_code, c.product?.name, c.customer?.name, c.receipt?.receipt_number, c.receipt?.customer_reference, c.complaint_details,
        c.analysis, ...partsOf(c).flatMap((p: any) => [p.part_code, p.name])]
        .some((x) => String(x ?? "").toLowerCase().includes(s));
    }
    return true;
  });
  const counts = data.reduce((m: Record<string, number>, c: any) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {});
  const filtered = !!(q.trim() || customer || product || part || (status && status !== "OPEN_ALL"));

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 w-64" placeholder="Search no., serial, product, part, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="OPEN_ALL">All open</option>
            {Object.entries(COMPLAINT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] ?? 0})</option>)}
            <option value="">Everything</option>
          </select>
          <select className={cn(sel, "max-w-[14rem]")} value={customer} onChange={(e) => setCustomer(e.target.value)} aria-label="Customer">
            <option value="">All customers</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={cn(sel, "max-w-[14rem]")} value={product} onChange={(e) => setProduct(e.target.value)} aria-label="Product">
            <option value="">All products</option>
            {products.map((p: any) => <option key={p.id} value={p.id}>{p.part_code} · {p.name}</option>)}
          </select>
          <select className={cn(sel, "max-w-[14rem]")} value={part} onChange={(e) => setPart(e.target.value)} aria-label="Part">
            <option value="">All parts</option>
            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.part_code} · {p.name}</option>)}
          </select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCustomer(""); setProduct(""); setPart(""); setStatus(receiptId ? "" : "OPEN_ALL"); }}>Clear</Button>}
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{rows.length} complaint{rows.length === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadComplaintSheet(rows)}><Download className="h-4 w-4" /> Download sheet</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          {/* Fixed column shares: the table fits the page, so Status is never pushed off the right edge. */}
          <Table className="min-w-[60rem] table-fixed">
            <colgroup>
              <col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[11%]" /><col className="w-[15%]" />
              <col /><col className="w-[12%]" /><col className="w-[4.5rem]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Complaint / analysis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={7} rows={4} />
                : !rows.length ? <TableEmpty columns={7} message="No complaints here" hint={filtered ? "Clear the filters to see more." : "Receive one on the Receive tab."} />
                : rows.map((c: any) => {
                  const st = COMPLAINT_STATUS[c.status] ?? { label: c.status, tone: "outline" as const };
                  const atIqc = (c.parts ?? []).filter((p: any) => p.status !== "CLOSED").length;
                  const iqc = iqcSummary(c);
                  return (
                    <TableRow key={c.id} className="cursor-pointer align-top" onClick={() => setOpenId(c.id)}>
                      <TableCell>
                        <div className="whitespace-nowrap font-mono text-sm">{c.complaint_number}</div>
                        <div className="text-xs text-muted-foreground"><span className="whitespace-nowrap">{c.receipt?.receipt_number ?? "—"}</span> <span className="whitespace-nowrap">· {fmtDate(c.received_date)}</span></div>
                      </TableCell>
                      <TableCell className="text-sm">{c.customer?.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="whitespace-nowrap font-mono">{c.product?.part_code}</span>
                        {c.faulty && <div className="whitespace-nowrap text-xs text-muted-foreground">part {c.faulty.part_code}</div>}
                      </TableCell>
                      <TableCell className={cn("break-all font-mono text-sm", !c.serial_number && "text-muted-foreground")}>{c.serial_number ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div className="line-clamp-2">{c.complaint_details}</div>
                        {c.cause && <div className="line-clamp-2 text-xs text-muted-foreground">OQC: {causeLabel(c.cause)}{c.analysis ? ` · ${c.analysis}` : ""}</div>}
                        {iqc && <div className="line-clamp-2 text-xs text-muted-foreground">IQC: {iqc}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.tone} className="whitespace-normal">{st.label}</Badge>
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

const verdictLabel = (v?: string | null) => VERDICTS.find((x) => x.value === v)?.label ?? "";

/** IQC's findings on a complaint's parts, in one line: verdict and root cause per part. */
function iqcSummary(c: any) {
  return (c.parts ?? []).filter((p: any) => p.verdict || p.root_cause)
    .map((p: any) => [p.part?.part_code, verdictLabel(p.verdict), p.root_cause].filter(Boolean).join(" · ")).join("; ");
}

/**
 * The complaint sheet: one row per complaint as filtered on screen, with what was received,
 * OQC's analysis, every part sent to IQC with IQC's findings, and the resolution.
 */
function downloadComplaintSheet(rows: any[]) {
  const parts = (c: any, f: (p: any) => any) => (c.parts ?? []).map((p: any) => `${p.part?.part_code ?? ""}: ${f(p) ?? "—"}`).join(" | ");
  const header = ["Complaint no.", "Status", "Received on", "Receipt no.", "Customer", "Customer ref. (bill / DC)", "Product code", "Product", "Serial number",
    "Purchase date", "Customer's complaint", "Faulty part received", "OQC cause", "OQC findings", "OQC analysed on",
    "Parts sent to IQC", "Problem (OQC)", "IQC verdict", "Vendor", "Root cause", "Analysis / tests done", "RCA", "CAPA",
    "Resolution to the customer", "Closed on", "Days open"];
  const out = rows.map((c: any) => [
    c.complaint_number, COMPLAINT_STATUS[c.status]?.label ?? c.status, fmtDate(c.received_date), c.receipt?.receipt_number, c.customer?.name,
    c.receipt?.customer_reference, c.product?.part_code, c.product?.name, c.serial_number, fmtDate(c.purchase_date), c.complaint_details,
    c.faulty ? `${c.faulty.part_code} ${c.faulty.name}` : "", causeLabel(c.cause), c.analysis, fmtDate(c.analysed_at),
    (c.parts ?? []).map((p: any) => `${p.part?.part_code ?? ""} ${p.part?.name ?? ""} × ${p.quantity ?? 1}`).join(" | "),
    parts(c, (p) => p.problem), parts(c, (p) => verdictLabel(p.verdict)), parts(c, (p) => p.vendor?.name),
    parts(c, (p) => p.root_cause), parts(c, (p) => p.analysis),
    parts(c, (p) => (p.rca_path ? "Attached" : "None")), parts(c, (p) => (p.capa_path ? "Attached" : "None")),
    c.resolution, fmtDate(c.resolved_at), c.status === "CLOSED" ? "" : ageDays(c.received_date),
  ]);
  const bytes = writeWorkbook([{ name: "Complaints", header, rows: out,
    widths: [17, 14, 12, 17, 26, 18, 13, 30, 30, 12, 34, 30, 22, 40, 14, 34, 30, 16, 22, 34, 40, 10, 10, 36, 12, 9] }]);
  downloadBytes(bytes, `Customer complaints ${ddmmyyyy()}.xlsx`);
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
