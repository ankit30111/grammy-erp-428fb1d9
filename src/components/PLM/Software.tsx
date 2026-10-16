import { useState } from "react";
import { toast } from "sonner";
import { Check, Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModelVersionRow } from "@/hooks/useModels";
import {
  type BrandCode, type DocKind, type SoftwareRelease, downloadSoftwareFile, fmtDay, fmtSize, nextVersion, shortSum, showVersion,
  useModelSoftware, useSoftwareMutations,
} from "@/hooks/useSoftwareReleases";
import { cn } from "@/lib/utils";

/**
 * Software in R&D → Versions & brands.
 *   Base software (one card on the model): B0.1, B0.2 … internal set-up, no brand.
 *   Brand software (inside each brand code): 1.0, 1.1 … 2.0, built on a base and
 *   made for a BOM version, with the brand's EQ, BT name and voice prompt.
 * No locks while the process is being settled: files can be replaced at any step,
 * the testing report and issue list are reminders, the uploader can do the R&D check.
 */

const sel = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";

const releaseBadge = (r: SoftwareRelease) =>
  r.status === "APPROVED"
    ? r.kind === "BASE" ? <Badge>Approved</Badge>
      : r.in_production ? <Badge>In production</Badge> : <Badge variant="secondary">Approved · superseded</Badge>
    : r.status === "RD_CHECKED" ? <Badge variant="outline">R&amp;D checked · waiting for Management</Badge>
    : r.status === "REJECTED" ? <Badge variant="destructive">Rejected</Badge>
    : r.status === "WITHDRAWN" ? <Badge variant="secondary">Withdrawn</Badge>
    : <Badge variant={"warning" as any}>In testing</Badge>;

function FilePick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className={cn("flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-sm", file ? "text-foreground" : "text-muted-foreground")}
           title={file?.name ?? label}>
      <Paperclip className="h-4 w-4 shrink-0" />
      <span className="truncate">{file ? file.name : label}</span>
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
      <div className="mt-1 min-w-0 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

const FileLink = ({ path, name }: { path: string; name: string }) => (
  <button type="button" className="flex max-w-full items-center gap-1 truncate underline-offset-2 hover:underline" title={name}
          onClick={() => downloadSoftwareFile(path, name)}>
    <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span>
  </button>
);

const Swap = ({ label, onFile }: { label: string; onFile: (f: File) => void }) => (
  <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
    <Upload className="h-3.5 w-3.5" /> {label}
    <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
  </label>
);

type Blank = { version: string; details: string; file: File | null; testReport: File | null; issueList: File | null;
               base: string; bom: string; eq: string; bt: string; voice: string };
const blank = (version = "", bom = "", base = ""): Blank =>
  ({ version, details: "", file: null, testReport: null, issueList: null, base, bom, eq: "", bt: "", voice: "" });

/* ───────────────────────────── Base software ───────────────────────────── */

export function BaseSoftwareCard({ model, canEdit }: { model: { id: string; part_code: string }; canEdit: boolean }) {
  const { data } = useModelSoftware(model.id);
  const bases = (data?.releases ?? []).filter((r) => r.kind === "BASE");
  const m = useSoftwareMutations(model.id);
  const [f, setF] = useState<Blank | null>(null);

  const submit = () => {
    if (!f?.file) return toast.error("Choose the software file");
    if (!f.version.trim()) return toast.error("Enter the version");
    m.create.mutate({ kind: "BASE", modelCode: model.part_code, version: f.version, file: f.file, testReport: f.testReport, issueList: f.issueList, details: f.details },
      { onSuccess: () => setF(null) });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Base software</CardTitle>
          {canEdit && !f && <Button size="sm" variant="outline" onClick={() => setF(blank(nextVersion(bases.map((b) => b.version), "BASE")))}><Upload /> New base version</Button>}
        </div>
        <p className="text-xs text-muted-foreground">No brand, internal set-up only. Numbered B0.1, B0.2 … B1.0. Each brand's software is built on one of these.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {f && (
          <NewForm title={`New base version of ${model.part_code}`} f={f} setF={setF} prefix="B" pending={m.create.isPending}
                   onSubmit={submit} onCancel={() => setF(null)} />
        )}
        {!bases.length ? <p className="text-sm text-muted-foreground">No base software yet.</p>
          : bases.map((r) => <ReleaseCard key={r.id} r={r} modelCode={model.part_code} m={m} canEdit={canEdit} />)}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Brand software ──────────────────────────── */

/** One line for the brand codes table: what the brand runs, or what it still needs. */
export function BrandSoftwareSummary({ modelId, code }: { modelId: string; code: { id: string; model_version: string | null } }) {
  const { data } = useModelSoftware(modelId);
  const mine = (data?.releases ?? []).filter((r) => r.part_id === code.id);
  const cur = mine.find((r) => r.in_production);
  const pending = mine.filter((r) => r.status === "TESTING" || r.status === "RD_CHECKED").length;
  if (!mine.length) return <span className="text-sm text-destructive">Software needed</span>;
  return (
    <span className="text-sm">
      {cur ? <span className="font-mono font-medium">v{cur.version}</span> : <span className="text-muted-foreground">none approved</span>}
      {cur?.bom_version && cur.bom_version !== code.model_version && (
        <Badge variant="warning" className="ml-2">made for BOM v{cur.bom_version}</Badge>
      )}
      {pending > 0 && <span className="ml-2 text-xs text-muted-foreground">{pending} in progress</span>}
    </span>
  );
}

export function BrandSoftwarePanel({ model, code, versions, canEdit }: {
  model: { id: string; part_code: string }; code: BrandCode; versions: ModelVersionRow[]; canEdit: boolean;
}) {
  const { data } = useModelSoftware(model.id);
  const all = data?.releases ?? [];
  const releases = all.filter((r) => r.part_id === code.id);
  const bases = all.filter((r) => r.kind === "BASE");
  const m = useSoftwareMutations(model.id);
  const bomOf = (v?: string | null) => versions.find((x) => x.version === v)?.id ?? "";
  const [f, setF] = useState<Blank | null>(null);
  const current = releases.find((r) => r.in_production);
  const last = releases[0];

  const start = () => {
    const nf = blank(nextVersion(releases.map((r) => r.version), "BRAND"), bomOf(code.model_version), (bases.find((b) => b.status === "APPROVED") ?? bases[0])?.id ?? "");
    // a new version starts from the last one's brand settings, which R&D can change
    if (last) Object.assign(nf, { eq: last.eq_profile ?? "", bt: last.bt_name ?? "", voice: last.voice_prompt ?? "" });
    setF(nf);
  };
  const submit = () => {
    if (!f?.file) return toast.error("Choose the software file");
    if (!f.version.trim()) return toast.error("Enter the version");
    m.create.mutate({
      kind: "BRAND", modelCode: model.part_code, code, version: f.version, file: f.file, testReport: f.testReport, issueList: f.issueList,
      details: f.details, base_release_id: f.base || null, bom_version_id: f.bom || null, eq_profile: f.eq, bt_name: f.bt, voice_prompt: f.voice,
    }, { onSuccess: () => setF(null) });
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-mono font-medium">{code.part_code}</span> software{" "}
          {current
            ? <>· in production <span className="font-mono font-medium">v{current.version}</span>, approved {fmtDay(current.approved_at)}{current.approved_by_name ? ` by ${current.approved_by_name}` : ""}</>
            : releases.length ? <span className="text-muted-foreground">· none approved yet</span> : null}
        </p>
        {canEdit && !f && releases.length > 0 && <Button size="sm" variant="outline" onClick={start}><Upload /> New version</Button>}
      </div>

      {!releases.length && !f && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-destructive/50 p-3">
          <p className="text-sm"><span className="font-medium text-destructive">Software needed.</span> Upload {code.part_code}'s software with its brand details (EQ, BT name, voice prompt).</p>
          {canEdit && <Button size="sm" onClick={start}><Upload /> Upload software</Button>}
        </div>
      )}

      {f && (
        <NewForm title={`New version for ${code.part_code}`} f={f} setF={setF} prefix="v" pending={m.create.isPending}
                 onSubmit={submit} onCancel={() => setF(null)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">Built on base
              <select className={sel} value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })}>
                <option value="">Not on a base</option>
                {bases.map((b) => <option key={b.id} value={b.id}>B{b.version}{b.status === "APPROVED" ? "" : ` (${b.status.toLowerCase().replace("_", " ")})`}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">For BOM version
              <select className={sel} value={f.bom} onChange={(e) => setF({ ...f, bom: e.target.value })}>
                <option value="">Not tied to a BOM version</option>
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.version}{v.status === "DRAFT" ? " (draft)" : ""}{v.version === code.model_version ? " · brand is on this" : ""}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input className="h-9" placeholder="EQ profile" value={f.eq} onChange={(e) => setF({ ...f, eq: e.target.value })} />
            <Input className="h-9" placeholder="BT name" value={f.bt} onChange={(e) => setF({ ...f, bt: e.target.value })} />
            <Input className="h-9" placeholder="Voice prompt" value={f.voice} onChange={(e) => setF({ ...f, voice: e.target.value })} />
          </div>
        </NewForm>
      )}

      {releases.map((r) => (
        <ReleaseCard key={r.id} r={r} modelCode={model.part_code} m={m} canEdit={canEdit} brandOn={code.model_version} bases={bases} versions={versions} />
      ))}
    </div>
  );
}

/* ───────────────────────────── shared pieces ───────────────────────────── */

function NewForm({ title, f, setF, prefix, pending, onSubmit, onCancel, children }: {
  title: string; f: Blank; setF: (f: Blank) => void; prefix: string; pending: boolean;
  onSubmit: () => void; onCancel: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1fr)_minmax(0,1fr)]">
        <FilePick label="Software file *" file={f.file} onPick={(file) => setF({ ...f, file })} />
        <div className="flex h-9 items-center rounded-md border border-input pl-2 text-sm">
          <span className="text-muted-foreground">{prefix}</span>
          <input className="h-full w-full min-w-0 bg-transparent px-1 font-mono outline-none" aria-label="Version" placeholder="Version"
                 value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
        </div>
        <FilePick label="Testing report" file={f.testReport} onPick={(testReport) => setF({ ...f, testReport })} />
        <FilePick label="Issue list" file={f.issueList} onPick={(issueList) => setF({ ...f, issueList })} />
      </div>
      {children}
      <Textarea rows={1} className="min-h-9" placeholder="What changed in this version" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSubmit} disabled={pending}>{pending ? "Uploading…" : "Upload for testing"}</Button>
      </div>
    </div>
  );
}

function ReleaseCard({ r, modelCode, m, canEdit, brandOn, bases = [], versions = [] }: {
  r: SoftwareRelease; modelCode: string; m: ReturnType<typeof useSoftwareMutations>; canEdit: boolean;
  brandOn?: string | null; bases?: SoftwareRelease[]; versions?: ModelVersionRow[];
}) {
  const { canApprove } = usePermissions();
  const { canAccessModule } = useAuth() as any;
  const isRnd = canAccessModule("rnd");
  const [note, setNote] = useState<{ kind: "reject" | "reactivate"; text: string } | null>(null);
  const brand = r.kind === "BRAND";
  const save = (patch: Record<string, any>) => m.update.mutate({ id: r.id, ...patch });
  const text = (field: "eq_profile" | "bt_name" | "voice_prompt", placeholder: string) =>
    canEdit ? (
      <Input key={`${field}${r.updated_at}`} className="h-8 text-sm" placeholder={placeholder} defaultValue={r[field] ?? ""}
             onBlur={(e) => e.target.value.trim() !== (r[field] ?? "") && save({ [field]: e.target.value.trim() || null })} />
    ) : <span>{r[field] || "—"}</span>;

  const DocStep = ({ n, kind, label }: { n: number; kind: DocKind; label: string }) => {
    const path = r[`${kind}_path`], name = r[`${kind}_name`];
    return (
      <Step n={n} label={label} done={!!path}>
        {path ? <FileLink path={path} name={name ?? label} /> : !canEdit && <span className="text-muted-foreground">—</span>}
        {canEdit && <Swap label={path ? "Replace" : "Upload"} onFile={(file) => m.attach.mutate({ r, kind, file, modelCode })} />}
      </Step>
    );
  };

  return (
    <div className={cn("space-y-2 rounded-md border bg-background p-3", r.in_production && "border-primary/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{showVersion(r)}</span>
        {releaseBadge(r)}
        {brand && r.base_version && <span className="text-xs text-muted-foreground">on base B{r.base_version}</span>}
        {brand && r.bom_version && (
          <span className={cn("text-xs", brandOn && r.bom_version !== brandOn ? "text-warning" : "text-muted-foreground")}>
            for BOM v{r.bom_version}{brandOn && r.bom_version !== brandOn ? ` (brand now on v${brandOn})` : ""}
          </span>
        )}
        <span className="text-xs text-muted-foreground">uploaded {fmtDay(r.created_at)}{r.created_by_name ? ` by ${r.created_by_name}` : ""}</span>
        {canEdit && r.status !== "APPROVED" && !r.in_production && (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete this version"
                  onClick={() => window.confirm(`Delete ${showVersion(r)}${r.part_code ? ` of ${r.part_code}` : ""} and its files?`) && m.remove.mutate(r)}><Trash2 className="h-4 w-4" /></Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Step n={1} label="Software file" done>
          <FileLink path={r.file_path} name={r.file_name} />
          <div className="text-xs text-muted-foreground" title={r.sha256 ?? ""}>{fmtSize(r.file_size)}{r.sha256 ? ` · ${shortSum(r.sha256)}` : ""}</div>
          {canEdit && <Swap label="Replace" onFile={(file) => m.replaceFile.mutate({ r, file, modelCode })} />}
        </Step>
        <DocStep n={2} kind="test_report" label="Testing report" />
        <DocStep n={3} kind="issue_list" label="Issue list" />
        <Step n={4} label="R&D check" done={!!r.rd_checked_at}>
          {r.rd_checked_at ? <span>{fmtDay(r.rd_checked_at)} · {r.rd_checked_by_name}</span>
            : r.status === "TESTING" && (isRnd || canApprove) ? (
              <Button size="sm" className="h-7 px-2" disabled={m.update.isPending} onClick={() => save({ status: "RD_CHECKED" })}>Checked OK</Button>
            ) : <span className="text-muted-foreground">{r.status === "TESTING" ? "Waiting for R&D" : "—"}</span>}
          {r.status === "TESTING" && (!r.test_report_path || !r.issue_list_path) && (
            <div className="text-xs text-muted-foreground">Add the {[!r.test_report_path && "testing report", !r.issue_list_path && "issue list"].filter(Boolean).join(" and ")}</div>
          )}
        </Step>
        <Step n={5} label="Management approval" done={!!r.approved_at}>
          {r.approved_at ? <span>{fmtDay(r.approved_at)} · {r.approved_by_name}</span>
            : r.status === "RD_CHECKED" ? (
              canApprove ? <Button size="sm" className="h-7 px-2" disabled={m.update.isPending} onClick={() => save({ status: "APPROVED" })}>Approve</Button>
                : <span className="text-muted-foreground">Waiting for Management</span>
            ) : <span className="text-muted-foreground">—</span>}
        </Step>
      </div>

      {brand && (
        <div className="grid gap-2 text-sm sm:grid-cols-[repeat(5,minmax(0,1fr))]">
          <label className="space-y-1 text-xs text-muted-foreground">Base
            {canEdit ? (
              <select className={cn(sel, "h-8")} value={r.base_release_id ?? ""} onChange={(e) => save({ base_release_id: e.target.value || null })}>
                <option value="">Not on a base</option>
                {bases.map((b) => <option key={b.id} value={b.id}>B{b.version}</option>)}
              </select>
            ) : <span className="block text-sm text-foreground">{r.base_version ? `B${r.base_version}` : "—"}</span>}
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">BOM version
            {canEdit ? (
              <select className={cn(sel, "h-8")} value={r.bom_version_id ?? ""} onChange={(e) => save({ bom_version_id: e.target.value || null })}>
                <option value="">Not tied</option>
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.version}</option>)}
              </select>
            ) : <span className="block text-sm text-foreground">{r.bom_version ? `v${r.bom_version}` : "—"}</span>}
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">EQ profile{text("eq_profile", "EQ profile")}</label>
          <label className="space-y-1 text-xs text-muted-foreground">BT name{text("bt_name", "BT name")}</label>
          <label className="space-y-1 text-xs text-muted-foreground">Voice prompt{text("voice_prompt", "Voice prompt")}</label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(r.status === "TESTING" || r.status === "RD_CHECKED") && (canApprove || isRnd) && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setNote({ kind: "reject", text: "" })}>Reject</Button>
        )}
        {canEdit && (r.status === "REJECTED" || r.status === "RD_CHECKED") && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => save({ status: "TESTING" })}>Back to testing</Button>
        )}
        {brand && canApprove && (r.status === "WITHDRAWN" || (r.status === "APPROVED" && !r.in_production)) && (
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setNote({ kind: "reactivate", text: "" })}>Put back in production</Button>
        )}
      </div>
      {note && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (note.kind === "reject") m.update.mutate({ id: r.id, status: "REJECTED", decision_note: note.text }, { onSuccess: () => setNote(null) });
          else m.reactivate.mutate({ id: r.id, reason: note.text }, { onSuccess: () => setNote(null) });
        }}>
          <Input autoFocus className="h-9 flex-1" placeholder={note.kind === "reject" ? "Why it is rejected" : "Why this version goes back (the newer one is withdrawn)"}
                 value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
          <Button type="submit" size="sm" variant={note.kind === "reject" ? "destructive" : "default"} disabled={!note.text.trim()}>
            {note.kind === "reject" ? `Reject ${showVersion(r)}` : `Put ${showVersion(r)} back`}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setNote(null)}>Cancel</Button>
        </form>
      )}
      {r.decision_note && <p className={cn("text-sm", r.status === "REJECTED" ? "text-destructive" : "text-muted-foreground")}>{r.decision_note}</p>}
      {canEdit ? (
        <Textarea key={`${r.id}${r.updated_at}`} rows={1} className="min-h-9 text-sm" defaultValue={r.details ?? ""} placeholder="What changed in this version"
                  onBlur={(e) => e.target.value.trim() !== (r.details ?? "") && save({ details: e.target.value.trim() || null })} />
      ) : r.details && <p className="whitespace-pre-wrap text-sm">{r.details}</p>}
    </div>
  );
}
