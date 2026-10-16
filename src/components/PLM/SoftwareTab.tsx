import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  type BrandCode, type DocKind, type SoftwareRelease, downloadSoftwareFile, fmtDay, fmtSize, shortSum,
  useModelSoftware, useSoftwareMutations,
} from "@/hooks/useSoftwareReleases";
import { cn } from "@/lib/utils";

export const releaseBadge = (r: SoftwareRelease) =>
  r.status === "APPROVED"
    ? r.in_production ? <Badge>In production</Badge> : <Badge variant="secondary">Approved · superseded</Badge>
    : r.status === "RD_CHECKED" ? <Badge variant="outline">R&amp;D checked · waiting for Management</Badge>
    : r.status === "REJECTED" ? <Badge variant="destructive">Rejected</Badge>
    : r.status === "WITHDRAWN" ? <Badge variant="secondary">Withdrawn</Badge>
    : <Badge variant={"warning" as any}>In testing</Badge>;

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

const FileLink = ({ path, name }: { path: string; name: string }) => (
  <button type="button" className="flex max-w-full items-center gap-1 truncate underline-offset-2 hover:underline" title={name}
          onClick={() => downloadSoftwareFile(path, name)}>
    <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span>
  </button>
);

/**
 * R&D product → Software. Each brand code of the model has its own software;
 * every version goes through file, version, testing report, issue list, an
 * R&D check by someone other than the uploader, and Management's approval.
 */
export function SoftwareTab({ model, canEdit }: { model: { id: string; part_code: string } | null; canEdit: boolean }) {
  const { data, isLoading } = useModelSoftware(model?.id);
  const [codeId, setCodeId] = useState<string | null>(null);
  const codes = data?.codes ?? [];
  useEffect(() => { if (!codeId && codes.length) setCodeId(codes[0].id); }, [codes, codeId]);

  if (!model) return <p className="text-sm text-muted-foreground">This product has no model code yet, so it has no software.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!codes.length) {
    return (
      <Card><CardContent className="pt-6 text-sm text-muted-foreground">
        Software is released per brand code (e.g. {model.part_code}-PH). {model.part_code} has no brand codes yet: add them on Stage 1 or 2, then upload each brand's software here.
      </CardContent></Card>
    );
  }
  const releases = data?.releases ?? [];
  const code = codes.find((c) => c.id === codeId) ?? codes[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Software testing and release · <span className="font-mono">{model.part_code}</span></CardTitle>
        <p className="text-sm text-muted-foreground">Each brand code has its own software. Choose the brand code.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {codes.map((c) => {
            const mine = releases.filter((r) => r.part_id === c.id);
            const cur = mine.find((r) => r.in_production);
            const pending = mine.filter((r) => r.status === "TESTING" || r.status === "RD_CHECKED").length;
            return (
              <button key={c.id} type="button" onClick={() => setCodeId(c.id)}
                      className={cn("rounded-md border px-3 py-1.5 text-left text-sm", c.id === code.id ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                <div className="font-mono font-medium">{c.part_code}</div>
                <div className={cn("text-xs", cur ? "text-muted-foreground" : "text-destructive")}>
                  {cur ? `v${cur.version} in production` : "no approved software"}{pending ? ` · ${pending} in progress` : ""}
                </div>
              </button>
            );
          })}
        </div>
        <BrandSoftware key={code.id} modelId={model.id} code={code} releases={releases.filter((r) => r.part_id === code.id)} canEdit={canEdit} />
      </CardContent>
    </Card>
  );
}

function BrandSoftware({ modelId, code, releases, canEdit }: { modelId: string; code: BrandCode; releases: SoftwareRelease[]; canEdit: boolean }) {
  const { canApprove } = usePermissions();
  const { user, canAccessModule } = useAuth() as any;
  const isRnd = canAccessModule("rnd");
  const m = useSoftwareMutations(modelId);
  const [f, setF] = useState<{ version: string; details: string; file: File | null; testReport: File | null; issueList: File | null }>(
    { version: "", details: "", file: null, testReport: null, issueList: null });
  const [note, setNote] = useState<{ id: string; kind: "reject" | "reactivate"; text: string } | null>(null);
  const current = releases.find((r) => r.in_production);

  const submit = () => {
    if (!f.file) return toast.error("Choose the software file");
    if (!f.version.trim()) return toast.error("Enter the version");
    m.create.mutate({ code, version: f.version, file: f.file, testReport: f.testReport, issueList: f.issueList, details: f.details },
      { onSuccess: () => setF({ version: "", details: "", file: null, testReport: null, issueList: null }) });
  };

  const DocStep = ({ r, n, kind, label }: { r: SoftwareRelease; n: number; kind: DocKind; label: string }) => {
    const path = r[`${kind}_path`], name = r[`${kind}_name`];
    return (
      <Step n={n} label={label} done={!!path}>
        {path ? <FileLink path={path} name={name ?? label} /> : null}
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
    <div className="space-y-4">
      <p className="text-sm">
        <span className="font-mono font-medium">{code.part_code}</span>{" "}
        {current
          ? <>· in production: <span className="font-mono font-medium">v{current.version}</span>, approved {fmtDay(current.approved_at)}{current.approved_by_name ? ` by ${current.approved_by_name}` : ""}</>
          : <span className="text-destructive">· no software approved for production yet</span>}
      </p>

      {canEdit && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">New version for {code.part_code}</div>
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
          <p className="text-xs text-muted-foreground">The testing report and issue list can be added later; both are needed before the R&amp;D check.</p>
        </div>
      )}

      {!releases.length ? <p className="text-sm text-muted-foreground">No software uploaded for {code.part_code} yet.</p>
        : releases.map((r) => {
          const mine = r.created_by === user?.id;
          return (
            <div key={r.id} className={cn("space-y-2 rounded-md border p-3", r.in_production && "border-primary/50")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-semibold">v{r.version}</span>
                {releaseBadge(r)}
                <span className="text-xs text-muted-foreground">uploaded {fmtDay(r.created_at)}{r.created_by_name ? ` by ${r.created_by_name}` : ""}</span>
                {canEdit && r.status === "TESTING" && (
                  <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete this version"
                          onClick={() => window.confirm(`Delete v${r.version} of ${r.part_code} and its files?`) && m.remove.mutate(r)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Step n={1} label="Software file" done>
                  <FileLink path={r.file_path} name={r.file_name} />
                  <div className="text-xs text-muted-foreground" title={r.sha256 ?? ""}>{fmtSize(r.file_size)}{r.sha256 ? ` · ${shortSum(r.sha256)}` : ""}</div>
                </Step>
                <Step n={2} label="Version" done><span className="font-mono">v{r.version}</span></Step>
                <DocStep r={r} n={3} kind="test_report" label="Testing report" />
                <DocStep r={r} n={4} kind="issue_list" label="Issue list" />
                <Step n={5} label="R&D check" done={!!r.rd_checked_at}>
                  {r.rd_checked_at ? <span>{fmtDay(r.rd_checked_at)} · {r.rd_checked_by_name}</span>
                    : r.status === "TESTING" ? (
                      isRnd && !mine ? (
                        <Button size="sm" className="h-7 px-2" disabled={!r.test_report_path || !r.issue_list_path || m.update.isPending}
                                title={!r.test_report_path || !r.issue_list_path ? "Needs the testing report and issue list" : undefined}
                                onClick={() => m.update.mutate({ id: r.id, status: "RD_CHECKED" })}>Checked OK</Button>
                      ) : <span className="text-muted-foreground">{mine ? "Another R&D person checks it" : "Waiting for R&D"}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                </Step>
                <Step n={6} label="Management approval" done={!!r.approved_at}>
                  {r.approved_at ? <span>{fmtDay(r.approved_at)} · {r.approved_by_name}</span>
                    : r.status === "RD_CHECKED" ? (
                      canApprove ? <Button size="sm" className="h-7 px-2" disabled={m.update.isPending} onClick={() => m.update.mutate({ id: r.id, status: "APPROVED" })}>Approve</Button>
                        : <span className="text-muted-foreground">Waiting for Management</span>
                    ) : <span className="text-muted-foreground">—</span>}
                </Step>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(r.status === "TESTING" || r.status === "RD_CHECKED") && (canApprove || (isRnd && !mine)) && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setNote({ id: r.id, kind: "reject", text: "" })}>Reject</Button>
                )}
                {canEdit && r.status === "REJECTED" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => m.update.mutate({ id: r.id, status: "TESTING" })}>Back to testing</Button>
                )}
                {canApprove && (r.status === "WITHDRAWN" || (r.status === "APPROVED" && !r.in_production)) && (
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setNote({ id: r.id, kind: "reactivate", text: "" })}>Put back in production</Button>
                )}
              </div>
              {note?.id === r.id && (
                <form className="flex flex-wrap gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (note.kind === "reject") m.update.mutate({ id: r.id, status: "REJECTED", decision_note: note.text }, { onSuccess: () => setNote(null) });
                  else m.reactivate.mutate({ id: r.id, reason: note.text }, { onSuccess: () => setNote(null) });
                }}>
                  <Input autoFocus className="h-9 flex-1" placeholder={note.kind === "reject" ? "Why it is rejected" : "Why this version goes back (the newer one is withdrawn)"}
                         value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
                  <Button type="submit" size="sm" variant={note.kind === "reject" ? "destructive" : "default"} disabled={!note.text.trim()}>
                    {note.kind === "reject" ? `Reject v${r.version}` : `Put v${r.version} back`}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setNote(null)}>Cancel</Button>
                </form>
              )}
              {r.decision_note && <p className={cn("text-sm", r.status === "REJECTED" ? "text-destructive" : "text-muted-foreground")}>{r.decision_note}</p>}
              {canEdit ? (
                <Textarea key={`${r.id}${r.updated_at}`} rows={1} className="min-h-9 text-sm" defaultValue={r.details ?? ""} placeholder="What changed in this version"
                          onBlur={(e) => e.target.value.trim() !== (r.details ?? "") && m.update.mutate({ id: r.id, details: e.target.value.trim() || null })} />
              ) : r.details && <p className="whitespace-pre-wrap text-sm">{r.details}</p>}
            </div>
          );
        })}
    </div>
  );
}
