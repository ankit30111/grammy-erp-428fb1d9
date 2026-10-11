import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import {
  PART_STATUS, VERDICTS, ageDays, causeLabel, fmtDate, openComplaintDoc, uploadComplaintDoc,
  useCanHandleComplaints, useComplaintMutations, useComplaintPartsForIqc,
} from "@/hooks/useComplaints";
import { cn } from "@/lib/utils";

const db = supabase as any;
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/**
 * IQC's side of a complaint: each faulty part OQC sent is checked here —
 * verdict, the vendor it came from, root cause, RCA and CAPA — then closed.
 * When every part of a complaint is closed, the complaint's analysis is done.
 */
export function ComplaintPartsIqc() {
  const { data = [], isLoading } = useComplaintPartsForIqc();
  const [show, setShow] = useState<"open" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data.filter((p: any) => show === "all" || p.status !== "CLOSED");
  const current = data.find((p: any) => p.id === openId);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {([["open", "To analyse"], ["all", "All"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setShow(k)}
                      className={cn("rounded px-3 py-1", show === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
            ))}
          </div>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{rows.length} part{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Problem (OQC)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={6} rows={3} />
                : !rows.length ? <TableEmpty columns={6} message="Nothing to analyse" hint="OQC sends faulty parts here from a complaint." />
                : rows.map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setOpenId(p.id)}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-sm">{p.complaint?.complaint_number}</div>
                      <div className="text-xs text-muted-foreground">{p.complaint?.customer?.name} · {p.complaint?.product?.part_code}</div>
                    </TableCell>
                    <TableCell className="text-sm"><span className="font-mono">{p.part?.part_code}</span> {p.part?.name} × {p.quantity}</TableCell>
                    <TableCell className="max-w-[18rem] truncate text-sm">{p.problem}</TableCell>
                    <TableCell><Badge variant={p.status === "CLOSED" ? "outline" : p.status === "ANALYSED" ? "secondary" : "default"}>{PART_STATUS[p.status]}</Badge></TableCell>
                    <TableCell className="text-sm">{VERDICTS.find((v) => v.value === p.verdict)?.label ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.status === "CLOSED" ? "" : ageDays(p.sent_at)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {current && <PartAnalysisDialog part={current} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

function PartAnalysisDialog({ part: p, onClose }: { part: any; onClose: () => void }) {
  const canEdit = useCanHandleComplaints() && p.status !== "CLOSED";
  const m = useComplaintMutations();
  const primaryVendor = (p.part?.part_vendors ?? []).find((v: any) => v.is_primary)?.vendor_id ?? null;
  const [f, setF] = useState({
    verdict: p.verdict ?? "", vendor_id: p.vendor_id ?? primaryVendor ?? "", root_cause: p.root_cause ?? "", analysis: p.analysis ?? "",
  });
  const [busy, setBusy] = useState<"rca" | "capa" | null>(null);

  const vendorIds = (p.part?.part_vendors ?? []).map((v: any) => v.vendor_id);
  const { data: vendors = [] } = useQuery({
    queryKey: ["complaint-part-vendors", p.part?.id],
    queryFn: async () => {
      const { data, error } = await db.from("vendors").select("id, name, vendor_code").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  // The part's own vendors first.
  const ordered = [...vendors].sort((a: any, b: any) => Number(vendorIds.includes(b.id)) - Number(vendorIds.includes(a.id)) || a.name.localeCompare(b.name));

  const save = (status?: "ANALYSED" | "CLOSED") =>
    m.updatePart.mutate({
      id: p.id, complaintId: p.complaint?.id,
      verdict: f.verdict || null, vendor_id: f.vendor_id || null, root_cause: f.root_cause.trim() || null, analysis: f.analysis.trim() || null,
      ...(status ? { status } : {}),
    }, { onSuccess: () => { toast.success(status === "CLOSED" ? "Part closed" : "Saved"); if (status) onClose(); } });

  const upload = async (kind: "rca" | "capa", file: File) => {
    setBusy(kind);
    try {
      const path = await uploadComplaintDoc(p.complaint?.complaint_number ?? "complaint", kind, file);
      m.updatePart.mutate({ id: p.id, complaintId: p.complaint?.id, [`${kind}_path`]: path });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const Doc = ({ kind, label }: { kind: "rca" | "capa"; label: string }) => {
    const path = p[`${kind}_path`];
    return (
      <div className="flex items-center gap-2">
        {path ? <Button type="button" variant="outline" size="sm" onClick={() => openComplaintDoc(path)}>{label}</Button>
          : <span className="text-sm text-muted-foreground">{label}: none</span>}
        {canEdit && (
          <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted", busy === kind && "opacity-50")}>
            <Paperclip className="h-4 w-4" /> {path ? "Replace" : "Attach"}
            <input type="file" className="sr-only" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) upload(kind, fl); }} />
          </label>
        )}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,900px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle><span className="font-mono">{p.part?.part_code}</span> {p.part?.name}</DialogTitle>
          <DialogDescription>
            From complaint <span className="font-mono">{p.complaint?.complaint_number}</span> · {p.complaint?.customer?.name} ·{" "}
            <span className="font-mono">{p.complaint?.product?.part_code}</span>{p.complaint?.serial_number ? ` · S/N ${p.complaint.serial_number}` : ""} · sent {fmtDate(p.sent_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
          <div><div className="text-xs text-muted-foreground">Customer's complaint</div>{p.complaint?.complaint_details}</div>
          <div><div className="text-xs text-muted-foreground">OQC</div>
            {[causeLabel(p.complaint?.cause), p.complaint?.analysis].filter(Boolean).join(" · ") || "—"}
            {p.problem && <div>Part: {p.problem}</div>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">Verdict
            <select className={sel} disabled={!canEdit} value={f.verdict} onChange={(e) => setF({ ...f, verdict: e.target.value })}>
              <option value="">Choose…</option>
              {VERDICTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Vendor of this part
            <select className={sel} disabled={!canEdit} value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })}>
              <option value="">Not a vendor issue / unknown</option>
              {ordered.map((v: any) => <option key={v.id} value={v.id}>{vendorIds.includes(v.id) ? "★ " : ""}{v.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">Root cause
            <Textarea rows={2} disabled={!canEdit} value={f.root_cause} onChange={(e) => setF({ ...f, root_cause: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">Analysis / tests done
            <Textarea rows={3} disabled={!canEdit} value={f.analysis} onChange={(e) => setF({ ...f, analysis: e.target.value })} />
          </label>
        </div>

        <div className="flex flex-wrap gap-4"><Doc kind="rca" label="RCA" /><Doc kind="capa" label="CAPA" /></div>

        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => save()}>Save</Button>
            {p.status === "UNDER_ANALYSIS" && <Button variant="outline" disabled={!f.verdict} onClick={() => save("ANALYSED")}>Mark analysed</Button>}
            <Button disabled={!f.verdict || !f.root_cause.trim()} onClick={() => save("CLOSED")}>Close part</Button>
          </div>
        ) : p.status === "CLOSED" && <p className="text-sm text-muted-foreground">Closed {fmtDate(p.closed_at)}.</p>}
      </DialogContent>
    </Dialog>
  );
}
