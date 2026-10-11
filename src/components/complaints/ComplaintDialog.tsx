import { useMemo, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBomTree } from "@/hooks/useBOM";
import {
  CAUSES, COMPLAINT_STATUS, PART_STATUS, VERDICTS, ageDays, fmtDate, receiptTypeLabel,
  useCanHandleComplaints, useComplaint, useComplaintMutations, openComplaintDoc,
} from "@/hooks/useComplaints";
import { flattenBom } from "./ComplaintReceiptForm";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="break-words text-sm">{children || <span className="text-muted-foreground">—</span>}</div>
  </div>
);

/**
 * One complaint (one unit): what was received, OQC's analysis, the faulty parts
 * sent to IQC with IQC's findings, and the closing resolution.
 */
export function ComplaintDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: c, isLoading } = useComplaint(id);
  const canEdit = useCanHandleComplaints();
  const m = useComplaintMutations();
  const closed = c?.status === "CLOSED";
  const edit = canEdit && !closed;

  const { tree } = useBomTree(c?.part_id ?? undefined);
  const bomParts = useMemo(() => flattenBom(tree).sort((a, b) => a.part_code.localeCompare(b.part_code, "en", { numeric: true })), [tree]);
  const [pick, setPick] = useState({ part_id: "", quantity: "1", problem: "" });
  const [resolution, setResolution] = useState<string | null>(null);

  const st = c ? COMPLAINT_STATUS[c.status] ?? { label: c.status, tone: "outline" as const } : null;
  const openParts = (c?.partRows ?? []).filter((p: any) => p.status !== "CLOSED").length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1100px)] max-w-none overflow-y-auto">
        {isLoading || !c ? <DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader> : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-3 pr-8">
                <DialogTitle className="font-mono">{c.complaint_number}</DialogTitle>
                <Badge variant={st!.tone}>{st!.label}</Badge>
                <span className="text-sm text-muted-foreground">{closed ? `closed ${fmtDate(c.resolved_at)}` : `${ageDays(c.received_date)} days open`}</span>
              </div>
              <DialogDescription>
                {c.customer?.name} · <span className="font-mono">{c.product?.part_code}</span> {c.product?.name}
              </DialogDescription>
            </DialogHeader>

            {/* 1. Received */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Received</h3>
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-6">
                <Field label="Receipt">{c.receipt ? <span className="font-mono">{c.receipt.receipt_number}</span> : null}</Field>
                <Field label="Type">{receiptTypeLabel(c.receipt?.receipt_type)}</Field>
                <Field label="Bill / DC / ref.">{c.receipt?.customer_reference}</Field>
                <Field label="Received on">{fmtDate(c.received_date)}</Field>
                <Field label="Purchase date">{fmtDate(c.purchase_date)}</Field>
                <Field label="Faulty part received">{c.faulty ? <><span className="font-mono">{c.faulty.part_code}</span> {c.faulty.name}</> : null}</Field>
                <div className="sm:col-span-3 lg:col-span-6"><Field label="Customer's complaint">{c.complaint_details}</Field></div>
              </div>
            </section>

            {/* 2. OQC analysis */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">OQC analysis</h3>
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[12rem_14rem_minmax(0,1fr)]">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Serial number</Label>
                  {edit ? <Input key={`s${c.serial_number}`} defaultValue={c.serial_number ?? ""} className="font-mono"
                                 onBlur={(e) => e.target.value.trim() !== (c.serial_number ?? "") && m.updateComplaint.mutate({ id, serial_number: e.target.value.trim() || null })} />
                    : <div className="font-mono text-sm">{c.serial_number ?? "—"}</div>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cause</Label>
                  {edit ? (
                    <select className={sel} value={c.cause ?? ""} onChange={(e) => m.updateComplaint.mutate({ id, cause: e.target.value || null })}>
                      <option value="">Not decided yet</option>
                      {CAUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  ) : <div className="text-sm">{CAUSES.find((x) => x.value === c.cause)?.label ?? "—"}</div>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Findings</Label>
                  {edit ? <Textarea key={`a${c.analysis}`} rows={2} defaultValue={c.analysis ?? ""} placeholder="What was checked and found"
                                    onBlur={(e) => e.target.value.trim() !== (c.analysis ?? "") && m.updateComplaint.mutate({ id, analysis: e.target.value.trim() || null })} />
                    : <p className="whitespace-pre-wrap text-sm">{c.analysis ?? "—"}</p>}
                </div>
              </div>
            </section>

            {/* 3. Faulty parts → IQC */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Faulty parts sent to IQC</h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead className="w-14 text-right">Qty</TableHead>
                      <TableHead>Problem (OQC)</TableHead>
                      <TableHead>IQC</TableHead>
                      <TableHead>Verdict · vendor</TableHead>
                      <TableHead>Root cause</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!c.partRows.length && (
                      <TableRow><TableCell colSpan={7} className="py-4 text-center text-sm text-muted-foreground">None sent.</TableCell></TableRow>
                    )}
                    {c.partRows.map((p: any) => (
                      <TableRow key={p.id} className="align-top">
                        <TableCell className="text-sm"><span className="font-mono">{p.part?.part_code}</span> {p.part?.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                        <TableCell className="text-sm">{p.problem}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{PART_STATUS[p.status] ?? p.status}
                          <div className="text-xs text-muted-foreground">{fmtDate(p.status === "CLOSED" ? p.closed_at : p.sent_at)}</div></TableCell>
                        <TableCell className="text-sm">
                          {VERDICTS.find((v) => v.value === p.verdict)?.label ?? "—"}{p.vendor ? ` · ${p.vendor.name}` : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.root_cause ?? p.analysis ?? "—"}
                          <div className="flex gap-2 text-xs">
                            {p.rca_path && <button type="button" className="underline" onClick={() => openComplaintDoc(p.rca_path)}>RCA</button>}
                            {p.capa_path && <button type="button" className="underline" onClick={() => openComplaintDoc(p.capa_path)}>CAPA</button>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {edit && p.status === "UNDER_ANALYSIS" && (
                            <Button variant="ghost" size="icon" aria-label="Take back" title="Take back from IQC"
                                    onClick={() => m.removePart.mutate({ id: p.id, complaintId: id })}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {edit && (
                <form className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_5rem_minmax(0,1.2fr)_auto]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!pick.part_id) return;
                        m.sendParts.mutate({ complaintId: id, rows: [{ part_id: pick.part_id, quantity: Number(pick.quantity) || 1, problem: pick.problem.trim() }] },
                          { onSuccess: () => setPick({ part_id: "", quantity: "1", problem: "" }) });
                      }}>
                  <select className={sel} value={pick.part_id} onChange={(e) => setPick({ ...pick, part_id: e.target.value })}>
                    <option value="">{bomParts.length ? "Part from the BOM…" : "No BOM for this product"}</option>
                    {bomParts.map((b) => <option key={b.part_id} value={b.part_id}>{b.part_code} · {b.name}</option>)}
                  </select>
                  <Input type="number" min={1} value={pick.quantity} onChange={(e) => setPick({ ...pick, quantity: e.target.value })} />
                  <Input value={pick.problem} placeholder="What is wrong with it" onChange={(e) => setPick({ ...pick, problem: e.target.value })} />
                  <Button type="submit" disabled={!pick.part_id || m.sendParts.isPending}><Send className="h-4 w-4" /> Send to IQC</Button>
                </form>
              )}
            </section>

            {/* 4. Close */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Resolution to the customer</h3>
              {canEdit ? (
                <div className="space-y-2">
                  <Textarea rows={2} value={resolution ?? c.resolution ?? ""} onChange={(e) => setResolution(e.target.value)}
                            placeholder="Repaired and returned, unit replaced, credit note, CAPA shared…" />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {openParts > 0 && !closed && <span className="text-sm text-muted-foreground">{openParts} part(s) still at IQC</span>}
                    {closed ? (
                      <>
                        <Button variant="outline" disabled={resolution === null || resolution.trim() === (c.resolution ?? "")}
                                onClick={() => m.updateComplaint.mutate({ id, resolution: resolution!.trim() }, { onSuccess: () => setResolution(null) })}>Save resolution</Button>
                        <Button variant="ghost" onClick={() => m.updateComplaint.mutate({ id, status: c.partRows.length ? "RESOLVED" : c.cause || c.analysis ? "UNDER_REVIEW" : "OPEN" })}>Reopen</Button>
                      </>
                    ) : (
                      <Button disabled={openParts > 0 || !(resolution ?? c.resolution ?? "").trim() || m.updateComplaint.isPending}
                              onClick={() => m.updateComplaint.mutate({ id, status: "CLOSED", resolution: (resolution ?? c.resolution ?? "").trim() }, { onSuccess: () => setResolution(null) })}>
                        Close complaint
                      </Button>
                    )}
                  </div>
                </div>
              ) : <p className="whitespace-pre-wrap text-sm">{c.resolution ?? "—"}</p>}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
