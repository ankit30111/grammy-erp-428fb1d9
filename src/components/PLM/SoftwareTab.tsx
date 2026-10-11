import { useState } from "react";
import { toast } from "sonner";
import { Check, Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import {
  type DocKind, type SoftwareRelease, downloadSoftwareFile, fmtDay, useSoftwareMutations, useSoftwareReleases,
} from "@/hooks/useSoftwareReleases";
import { cn } from "@/lib/utils";

export const releaseBadge = (r: SoftwareRelease) =>
  r.status === "APPROVED"
    ? r.in_production ? <Badge>In production</Badge> : <Badge variant="secondary">Approved · superseded</Badge>
    : r.status === "REJECTED" ? <Badge variant="destructive">Rejected</Badge> : <Badge variant={"warning" as any}>In testing</Badge>;

function FilePick({ label, file, onPick, required }: { label: string; file: File | null; onPick: (f: File | null) => void; required?: boolean }) {
  return (
    <label className={cn("flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-sm", file ? "text-foreground" : "text-muted-foreground")}
           title={file?.name ?? label}>
      <Paperclip className="h-4 w-4 shrink-0" />
      <span className="truncate">{file ? file.name : `${label}${required ? " *" : ""}`}</span>
      <input type="file" className="sr-only" onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
    </label>
  );
}

/** One step of a release: done (with its file), or what is missing. */
function Step({ n, label, done, children }: { n: number; label: string; done: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-md border p-2", done ? "border-success/40 bg-success/5" : "border-dashed")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {done ? <Check className="h-3.5 w-3.5 text-success" /> : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px]">{n}</span>}
        {label}
      </div>
      <div className="mt-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

/**
 * R&D product → Software. Every product's software goes through the same
 * five steps; Management or Admin approves it for production, and from then it
 * shows on the model's finished goods.
 */
export function SoftwareTab({ model, canEdit }: { model: { id: string; part_code: string } | null; canEdit: boolean }) {
  const { canApprove } = usePermissions();
  const { data: releases = [], isLoading } = useSoftwareReleases(model?.id);
  const m = useSoftwareMutations(model?.id ?? "", model?.part_code ?? "");
  const [f, setF] = useState<{ version: string; details: string; file: File | null; testReport: File | null; issueList: File | null }>(
    { version: "", details: "", file: null, testReport: null, issueList: null });
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  if (!model) return <p className="text-sm text-muted-foreground">This product has no model code yet, so it has no software.</p>;
  const current = releases.find((r) => r.in_production);

  const submit = () => {
    if (!f.file) return toast.error("Choose the software file");
    if (!f.version.trim()) return toast.error("Enter the version");
    m.create.mutate({ version: f.version, file: f.file, testReport: f.testReport, issueList: f.issueList, details: f.details },
      { onSuccess: () => setF({ version: "", details: "", file: null, testReport: null, issueList: null }) });
  };

  const DocStep = ({ r, n, kind, label }: { r: SoftwareRelease; n: number; kind: DocKind; label: string }) => {
    const path = r[`${kind}_path`], name = r[`${kind}_name`];
    return (
      <Step n={n} label={label} done={!!path}>
        {path ? (
          <button type="button" className="flex max-w-full items-center gap-1 truncate underline-offset-2 hover:underline" title={name ?? ""}
                  onClick={() => downloadSoftwareFile(path, name ?? label)}>
            <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span>
          </button>
        ) : null}
        {canEdit && r.status === "TESTING" && (
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Upload className="h-3.5 w-3.5" /> {path ? "Replace" : "Upload"}
            <input type="file" className="sr-only" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) m.attach.mutate({ r, kind, file: fl }); }} />
          </label>
        )}
        {!path && !(canEdit && r.status === "TESTING") && <span className="text-muted-foreground">—</span>}
      </Step>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Software testing and release · <span className="font-mono">{model.part_code}</span></CardTitle>
        <p className="text-sm text-muted-foreground">
          {current ? <>In production: <span className="font-mono font-medium text-foreground">v{current.version}</span>, approved {fmtDay(current.decided_at)}{current.decided_by_name ? ` by ${current.decided_by_name}` : ""}.</>
            : "No software approved for production yet."} Approved software shows on the finished goods of {model.part_code}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">New version</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1fr)_minmax(0,1fr)]">
              <FilePick label="1 · Software file" file={f.file} onPick={(file) => setF({ ...f, file })} required />
              <Input className="h-9" placeholder="2 · Version *" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
              <FilePick label="3 · Testing report" file={f.testReport} onPick={(testReport) => setF({ ...f, testReport })} />
              <FilePick label="4 · Issue list" file={f.issueList} onPick={(issueList) => setF({ ...f, issueList })} />
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Textarea rows={1} className="min-h-9 flex-1" placeholder="What changed in this version (optional)" value={f.details}
                        onChange={(e) => setF({ ...f, details: e.target.value })} />
              <Button onClick={submit} disabled={m.create.isPending}>{m.create.isPending ? "Uploading…" : "Upload for testing"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">The testing report and issue list can be added later; both are needed before approval.</p>
          </div>
        )}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : !releases.length ? <p className="text-sm text-muted-foreground">No software uploaded yet.</p>
          : releases.map((r) => (
            <div key={r.id} className={cn("space-y-2 rounded-md border p-3", r.in_production && "border-primary/50")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-semibold">v{r.version}</span>
                {releaseBadge(r)}
                <span className="text-xs text-muted-foreground">uploaded {fmtDay(r.created_at)}{r.created_by_name ? ` by ${r.created_by_name}` : ""}</span>
                {canEdit && r.status === "TESTING" && (
                  <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete this version"
                          onClick={() => window.confirm(`Delete v${r.version} and its files?`) && m.remove.mutate(r)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Step n={1} label="Software file" done>
                  <button type="button" className="flex max-w-full items-center gap-1 underline-offset-2 hover:underline" title={r.file_name}
                          onClick={() => downloadSoftwareFile(r.file_path, r.file_name)}>
                    <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.file_name}</span>
                  </button>
                </Step>
                <Step n={2} label="Version" done><span className="font-mono">v{r.version}</span></Step>
                <DocStep r={r} n={3} kind="test_report" label="Testing report" />
                <DocStep r={r} n={4} kind="issue_list" label="Issue list" />
                <Step n={5} label="Approved for production" done={r.status === "APPROVED"}>
                  {r.status === "APPROVED" ? <span>{fmtDay(r.decided_at)}{r.decided_by_name ? ` · ${r.decided_by_name}` : ""}</span>
                    : r.status === "REJECTED" ? <span className="text-destructive">Rejected {fmtDay(r.decided_at)}</span>
                    : canApprove ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" className="h-7 px-2" disabled={!r.test_report_path || !r.issue_list_path || m.update.isPending}
                                title={!r.test_report_path || !r.issue_list_path ? "Needs the testing report and issue list" : undefined}
                                onClick={() => m.update.mutate({ id: r.id, status: "APPROVED" })}>Approve</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setRejecting({ id: r.id, note: "" })}>Reject</Button>
                      </div>
                    ) : <span className="text-muted-foreground">Waiting for Management</span>}
                </Step>
              </div>
              {rejecting?.id === r.id && (
                <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); m.update.mutate({ id: r.id, status: "REJECTED", decision_note: rejecting.note }, { onSuccess: () => setRejecting(null) }); }}>
                  <Input autoFocus className="h-9 flex-1" placeholder="Why it is rejected" value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
                  <Button type="submit" variant="destructive" size="sm" disabled={!rejecting.note.trim()}>Reject v{r.version}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(null)}>Cancel</Button>
                </form>
              )}
              {r.status === "REJECTED" && r.decision_note && <p className="text-sm text-destructive">Reason: {r.decision_note}</p>}
              {canEdit ? (
                <Textarea key={`${r.id}${r.updated_at}`} rows={1} className="min-h-9 text-sm" defaultValue={r.details ?? ""} placeholder="What changed in this version"
                          onBlur={(e) => e.target.value.trim() !== (r.details ?? "") && m.update.mutate({ id: r.id, details: e.target.value.trim() || null })} />
              ) : r.details && <p className="whitespace-pre-wrap text-sm">{r.details}</p>}
              {canApprove && r.status === "REJECTED" && (
                <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => m.update.mutate({ id: r.id, status: "TESTING", decision_note: null })}>Back to testing</button>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
