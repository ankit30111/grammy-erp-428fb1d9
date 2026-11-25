import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { PartAnalysisDialog } from "@/components/complaints/ComplaintPartsIqc";
import {
  PART_STATUS, VERDICTS, ageDays, fmtDate, openComplaintDoc, uploadComplaintDoc, useCanHandleComplaints, useComplaintPartsForIqc,
} from "@/hooks/useComplaints";
import { CAPA_STATUS, LEVELS, levelLabel, useCanRelease, useFlagMutations, useInspectionFlags } from "@/hooks/useInspectionFlags";
import { cn } from "@/lib/utils";

const db = supabase as any;
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const verdictLabel = (v?: string | null) => VERDICTS.find((x) => x.value === v)?.label ?? "";

/**
 * Part Analysis: every part OQC sent to IQC from a customer complaint, with IQC's decision,
 * its RCA and CAPA documents and, when the part was found faulty, the raised inspection it set off.
 */
export function PartAnalysisCapasTab() {
  const { data = [], isLoading } = useComplaintPartsForIqc();
  const { data: flags = [] } = useInspectionFlags();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"open" | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const flagFor = (p: any) => flags.find((f: any) => f.status === "OPEN" && f.part_id === p.part?.id && (f.vendor_id === p.vendor_id || !f.vendor_id));

  const rows = data.filter((p: any) => {
    if (show === "open" && p.status === "CLOSED") return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return [p.complaint?.complaint_number, p.complaint?.customer?.name, p.complaint?.product?.part_code, p.part?.part_code, p.part?.name, p.vendor?.name, p.root_cause]
      .some((x) => String(x ?? "").toLowerCase().includes(s));
  });
  const current = data.find((p: any) => p.id === openId);
  const Doc = ({ path, label }: { path?: string | null; label: string }) => path
    ? <Button variant="outline" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); openComplaintDoc(path); }}>{label}</Button>
    : <span className="text-xs text-muted-foreground">{label}: none</span>;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 w-72" placeholder="Search complaint, part, vendor, root cause…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={sel} value={show} onChange={(e) => setShow(e.target.value as any)} aria-label="Show">
            <option value="all">All parts</option><option value="open">Not closed</option>
          </select>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{rows.length} part{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[62rem] table-fixed">
            <colgroup><col className="w-[15%]" /><col className="w-[17%]" /><col /><col className="w-[7rem]" /><col className="w-[10rem]" /><col className="w-[8.5rem]" /><col className="w-[7.5rem]" /></colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead><TableHead>Part</TableHead><TableHead>IQC decision</TableHead>
                <TableHead>Status</TableHead><TableHead>Dates</TableHead><TableHead>RCA · CAPA</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={7} rows={4} />
                : !rows.length ? <TableEmpty columns={7} message="No parts here" hint="OQC sends faulty parts to IQC from a complaint." />
                : rows.map((p: any) => {
                  const f = flagFor(p);
                  return (
                    <TableRow key={p.id} className="cursor-pointer align-top" onClick={() => setOpenId(p.id)}>
                      <TableCell>
                        <div className="whitespace-nowrap font-mono text-sm">{p.complaint?.complaint_number}</div>
                        <div className="text-xs text-muted-foreground">{p.complaint?.customer?.name}</div>
                        <div className="whitespace-nowrap font-mono text-xs text-muted-foreground">{p.complaint?.product?.part_code}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="whitespace-nowrap font-mono">{p.part?.part_code}</span> {p.part?.name} × {p.quantity}
                        {p.problem && <div className="line-clamp-2 text-xs text-muted-foreground">OQC: {p.problem}</div>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.verdict ? <div><span className="font-medium">{verdictLabel(p.verdict)}</span>{p.vendor?.name ? ` · ${p.vendor.name}` : ""}</div> : <span className="text-muted-foreground">Not decided yet</span>}
                        {p.root_cause && <div className="line-clamp-2 text-xs">Root cause: {p.root_cause}</div>}
                        {p.analysis && <div className="line-clamp-2 text-xs text-muted-foreground">Tests: {p.analysis}</div>}
                        {f && <div className="mt-1 text-xs font-medium text-warning">Inspection raised: {f.level ? levelLabel(f.level) : "level to set"} · {CAPA_STATUS[f.capa_status]?.label}</div>}
                      </TableCell>
                      <TableCell><Badge variant={p.status === "CLOSED" ? "outline" : p.status === "ANALYSED" ? "secondary" : "default"} className="whitespace-normal">{PART_STATUS[p.status] ?? p.status}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div className="whitespace-nowrap">Sent {fmtDate(p.sent_at)}</div>
                        {p.analysed_at && <div className="whitespace-nowrap">Analysed {fmtDate(p.analysed_at)}</div>}
                        {p.closed_at ? <div className="whitespace-nowrap">Closed {fmtDate(p.closed_at)}</div> : <div className="text-muted-foreground">{ageDays(p.sent_at)} days at IQC</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1"><Doc path={p.rca_path} label="RCA" /><Doc path={p.capa_path} label="CAPA" /></div>
                        {p.verdict === "FAULTY" && !p.capa_path && <div className="mt-1 text-xs font-medium text-destructive">CAPA missing</div>}
                      </TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}>View details</Button></TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {current && <PartAnalysisDialog part={current} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

/**
 * Raised inspection: parts (and vendors) IQC inspects at a higher level while a CAPA is awaited.
 * Quality chooses the level and records the CAPA; the QA head decides when it goes back to normal.
 * Nothing here blocks receiving or production.
 */
export function RaisedInspectionTab() {
  const { data = [], isLoading } = useInspectionFlags();
  const { data: canRelease = false } = useCanRelease();
  const canEdit = useCanHandleComplaints();
  const m = useFlagMutations();
  const [show, setShow] = useState<"OPEN" | "RELEASED">("OPEN");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data.filter((f: any) => f.status === show);

  const attach = async (f: any, file: File) => {
    setBusy(f.id);
    try {
      const path = await uploadComplaintDoc(`FLAG-${f.part?.part_code ?? "part"}`, "capa", file);
      m.capa.mutate({ p_flag: f.id, p_status: "RECEIVED", p_path: path, p_note: null });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {([["OPEN", "Raised now"], ["RELEASED", "Back to normal"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setShow(k)}
                      className={cn("rounded px-3 py-1", show === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Receiving and production carry on; IQC takes the larger sample shown in its inspection window.</p>
          {canEdit && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAdding(true)}>Flag a part</Button>}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[62rem] table-fixed">
            <colgroup><col className="w-10" /><col className="w-[20%]" /><col /><col className="w-[11rem]" /><col className="w-[14rem]" /><col className="w-[6.5rem]" /><col className="w-[9rem]" /></colgroup>
            <TableHeader>
              <TableRow>
                <TableHead /><TableHead>Part · vendor</TableHead><TableHead>Why</TableHead><TableHead>Inspection level</TableHead>
                <TableHead>Vendor CAPA</TableHead><TableHead className="whitespace-nowrap">Lots checked</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={7} rows={3} />
                : !rows.length ? <TableEmpty columns={7} message={show === "OPEN" ? "No part is under raised inspection" : "Nothing released yet"}
                                             hint="A part is flagged when IQC finds a vendor fault in a complaint, rejects a lot, or the line rejects it as faulty." />
                : rows.map((f: any) => {
                  const lots = f.events.filter((e: any) => e.kind === "LOT").length;
                  const faults = f.events.filter((e: any) => e.kind === "RAISED" || e.kind === "TRIGGER").length;
                  const st = CAPA_STATUS[f.capa_status];
                  const open = f.status === "OPEN";
                  return (
                    <Fragment key={f.id}>
                      <TableRow className="align-top">
                        <TableCell className="px-2">
                          <button type="button" aria-label="History" className="rounded p-1 hover:bg-muted" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                            {expanded === f.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div><span className="whitespace-nowrap font-mono">{f.part?.part_code}</span> {f.part?.name}</div>
                          <div className="text-xs text-muted-foreground">{f.vendor?.name ?? "Any vendor"}</div>
                          <div className="text-xs text-muted-foreground">Since {fmtDate(f.raised_at)}{open ? ` · ${ageDays(f.raised_at)} days` : ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="line-clamp-3">{f.first_reason}</div>
                          {faults > 1 && <div className="text-xs font-medium text-destructive">{faults} faults found</div>}
                          {f.release_note && <div className="text-xs text-muted-foreground">Released: {f.release_note}</div>}
                        </TableCell>
                        <TableCell>
                          {open && canEdit ? (
                            <select className={cn(sel, "w-full", !f.level && "border-warning text-warning")} value={f.level ?? ""} aria-label="Inspection level"
                                    onChange={(e) => e.target.value && m.setLevel.mutate({ p_flag: f.id, p_level: e.target.value, p_note: null })}>
                              <option value="">Choose…</option>
                              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                          ) : <span className="text-sm">{f.level ? LEVELS.find((l) => l.value === f.level)?.label : "Not set"}</span>}
                          {open && !f.level && <div className="mt-1 text-xs text-warning">IQC uses G2 until chosen</div>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {st && <Badge variant={st.tone}>{st.label}</Badge>}
                            {f.capa_path && <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => openComplaintDoc(f.capa_path)}>Open</Button>}
                          </div>
                          {open && canEdit && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <label className={cn("inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted", busy === f.id && "opacity-50")}>
                                <Paperclip className="h-3.5 w-3.5" /> {f.capa_path ? "Replace" : "Attach"}
                                <input type="file" className="sr-only" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) attach(f, fl); }} />
                              </label>
                              {f.capa_path && f.capa_status !== "ACCEPTED" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => m.capa.mutate({ p_flag: f.id, p_status: "ACCEPTED", p_path: null, p_note: null })}>Accept</Button>}
                              {f.capa_path && f.capa_status !== "REJECTED" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => m.capa.mutate({ p_flag: f.id, p_status: "REJECTED", p_path: null, p_note: null })}>Reject</Button>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{lots}</TableCell>
                        <TableCell className="text-right">
                          {open && canRelease && <Button size="sm" variant={f.capa_status === "ACCEPTED" ? "default" : "outline"} onClick={() => setReleasing(f)}>Back to normal</Button>}
                          {!open && <span className="text-xs text-muted-foreground">{fmtDate(f.released_at)}</span>}
                        </TableCell>
                      </TableRow>
                      {expanded === f.id && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={6} className="bg-muted/30">
                            <ul className="space-y-1 text-sm">
                              {f.events.map((e: any) => (
                                <li key={e.id} className="flex gap-3"><span className="w-24 shrink-0 text-xs text-muted-foreground">{fmtDate(e.at)}</span><span>{e.detail}</span></li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {releasing && <ReleaseDialog flag={releasing} onClose={() => setReleasing(null)} onRelease={(note) => m.release.mutate({ p_flag: releasing.id, p_note: note || null }, { onSuccess: () => setReleasing(null) })} />}
      {adding && <FlagPartDialog onClose={() => setAdding(false)} onFlag={(args) => m.manual.mutate(args, { onSuccess: () => setAdding(false) })} />}
    </Card>
  );
}

function ReleaseDialog({ flag, onClose, onRelease }: { flag: any; onClose: () => void; onRelease: (note: string) => void }) {
  const [note, setNote] = useState("");
  const needsReason = flag.capa_status !== "ACCEPTED";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Back to normal inspection</DialogTitle>
          <DialogDescription><span className="font-mono">{flag.part?.part_code}</span> {flag.part?.name} · {flag.vendor?.name ?? "any vendor"} returns to G1.</DialogDescription>
        </DialogHeader>
        {needsReason && <p className="flex gap-2 text-sm text-warning"><AlertTriangle className="h-4 w-4 shrink-0" /> The vendor's CAPA is not accepted yet. Say why inspection can go back to normal.</p>}
        <label className="grid gap-1.5 text-xs text-muted-foreground">{needsReason ? "Reason *" : "Note"}
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. CAPA verified; last 3 lots at G3 had no defects" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={needsReason && !note.trim()} onClick={() => onRelease(note.trim())}>Back to normal</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FlagPartDialog({ onClose, onFlag }: { onClose: () => void; onFlag: (args: Record<string, unknown>) => void }) {
  const [code, setCode] = useState("");
  const [part, setPart] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendor, setVendor] = useState("");
  const [level, setLevel] = useState("G2");
  const [reason, setReason] = useState("");
  const find = async () => {
    const { data } = await db.from("parts").select("id, part_code, name, part_vendors ( vendor_id, is_primary, vendor:vendors ( id, name ) )").eq("part_code", code.trim().toUpperCase()).maybeSingle();
    if (!data) { setPart(null); toast.error("No part with that code"); return; }
    setPart(data);
    const vs = (data.part_vendors ?? []).map((v: any) => v.vendor).filter(Boolean);
    setVendors(vs);
    setVendor((data.part_vendors ?? []).find((v: any) => v.is_primary)?.vendor_id ?? "");
  };
  const vendorOptions = useMemo(() => vendors, [vendors]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Flag a part</DialogTitle>
          <DialogDescription>IQC will inspect this part at the level you choose until the QA head releases it. Nothing is blocked.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-xs text-muted-foreground">Part code
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="e.g. E-090" className="font-mono" />
              <Button variant="outline" onClick={find} disabled={!code.trim()}>Find</Button>
            </div>
          </label>
          {part && <p className="text-sm"><span className="font-mono">{part.part_code}</span> {part.name}</p>}
          <label className="grid gap-1.5 text-xs text-muted-foreground">Vendor
            <select className={cn(sel, "w-full")} value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={!part}>
              <option value="">Any vendor of this part</option>
              {vendorOptions.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-muted-foreground">Inspection level
            <select className={cn(sel, "w-full")} value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-muted-foreground">Why *
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Field failures reported by the customer" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!part || !reason.trim()} onClick={() => onFlag({ p_part: part.id, p_vendor: vendor || null, p_level: level, p_reason: reason.trim() })}>Flag part</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
