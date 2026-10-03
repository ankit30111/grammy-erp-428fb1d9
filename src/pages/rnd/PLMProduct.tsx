import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreatePartDialog } from "@/components/Parts/CreatePartDialog";
import { toast } from "sonner";
import { Check, FileText, Lock, Paperclip, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import {
  BIS_STEPS, DELIVERABLE_STATES, STAGES, openPlmFile, uploadPlmFile, usePlmMutations, usePlmProduct, usePlmProducts,
} from "@/hooks/usePLM";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlantId } from "@/hooks/usePlantId";
import { PLM_CATEGORIES, useClientNames } from "@/components/PLM/NewProductDialog";
import { priorityVariant, stageLabel } from "./PLMDashboard";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const HOW: Record<string, string> = {
  AUTO: "passed by itself", RECORDED: "recorded", MANAGEMENT: "released by Management",
  OVERRIDE: "released by Management without the gate", IMPORTED: "from the PLM tracker",
};
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Upload control: shows the file when there is one, otherwise a picker. */
function FileCell({ path, disabled, onUpload }: { path?: string | null; disabled?: boolean; onUpload: (f: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-1">
      {path && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openPlmFile(path)} title={path.split("/").pop()}>
          <FileText className="h-4 w-4" /> Open
        </Button>
      )}
      {!disabled && (
        <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted", busy && "opacity-50")}>
          <Paperclip className="h-4 w-4" /> {path ? "Replace" : "Attach"}
          <input type="file" className="sr-only" disabled={busy} onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            setBusy(true);
            try { await onUpload(file); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
          }} />
        </label>
      )}
    </div>
  );
}

const Metric = ({ label, value, hint, bad }: { label: string; value: string; hint?: string; bad?: boolean }) => (
  <div className="rounded-md border p-3 min-w-[140px]">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn("text-xl font-semibold tabular-nums", bad && "text-destructive")}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const PLMProduct = () => {
  const { code } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = usePlmProduct(code);
  const { data: all } = usePlmProducts();
  const { canEditMasters, canApprove } = usePermissions();
  const canEdit = canEditMasters || canApprove;
  const m = usePlmMutations();
  const plantId = usePlantId();
  const tab = params.get("tab") ?? "stages";
  const [viewStage, setViewStage] = useState<number | null>(null);

  if (isLoading) return <DashboardLayout><p className="text-muted-foreground">Loading…</p></DashboardLayout>;
  if (!data) return <DashboardLayout><p>Product {code} not found. <Link className="underline" to="/rnd">Back to R&amp;D</Link></p></DashboardLayout>;

  const { product: p, metrics: mx } = data;
  const stage = viewStage ?? Math.min(p.stage, 6);
  const gateOf = (g: number) => data.gates.find((x: any) => x.gate === g);
  const products = all?.products ?? [];

  const upload = async (key: string, file: File) => uploadPlmFile(p.product_code, key, file);

  return (
    <DashboardLayout>
      <PageHeader
        title={`${p.product_code} · ${p.name}`}
        breadcrumb={[{ label: "R&D", to: "/rnd" }, { label: p.product_code }]}
        meta={<span>{p.client ?? "Grammy"}{p.category ? ` · ${p.category}` : ""}{p.business_model ? ` · ${p.business_model}` : ""}</span>}
        actions={canApprove && p.stage < 6 && <OverrideButton onRelease={(reason) => m.releaseOverride.mutate({ product: p.id, reason })} />}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={priorityVariant(p.priority)}>{p.priority.toLowerCase()} priority</Badge>
          {p.status !== "ACTIVE" && <Badge variant="secondary">{p.status === "ON_HOLD" ? "on hold" : "dropped"}</Badge>}
          {p.kind === "VARIATION" && (
            <span className="text-muted-foreground">
              Variation of {data.base ? <Link className="font-mono underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(data.base.product_code)}`}>{data.base.product_code}</Link> : "— (set the base product under Details)"}
            </span>
          )}
          {data.variations.length > 0 && (
            <span className="text-muted-foreground">
              Variations: {data.variations.map((v: any, i: number) => (
                <span key={v.id}>{i > 0 && ", "}<Link className="font-mono underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(v.product_code)}`}>{v.product_code}</Link>{v.client ? ` (${v.client})` : ""}</span>
              ))}
            </span>
          )}
          {data.fgs.length > 0 && <span className="text-muted-foreground">Codes: <span className="font-mono">{data.fgs.map((f: any) => f.part_code).join(", ")}</span></span>}
        </div>

        {/* Stage stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STAGES.map((s) => {
            const passed = s.n < p.stage;
            const current = s.n === p.stage;
            const g = gateOf(s.n);
            return (
              <button key={s.n} type="button" onClick={() => { setViewStage(s.n); setParams((x) => { x.set("tab", "stages"); return x; }); }}
                className={cn("rounded-lg border p-3 text-left transition-colors hover:border-primary bg-card",
                  stage === s.n && tab === "stages" && "ring-1 ring-primary border-primary",
                  current && "bg-primary/5")}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {passed ? <Check className="h-3.5 w-3.5 text-success" /> : current ? <span className="h-2 w-2 rounded-full bg-primary" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
                  Stage {s.n}
                </div>
                <div className="font-medium text-sm leading-tight">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {passed && g ? `${fmtDate(g.passed_at)}` : current ? `${mx.deliverables[s.n] ? `${mx.deliverables[s.n].done}/${mx.deliverables[s.n].total} done` : ""}` : ""}
                </div>
              </button>
            );
          })}
        </div>

        <TabBar
          tabs={[
            { id: "stages", label: "Stages" },
            { id: "tests", label: "Tests", count: data.tests.length },
            { id: "issues", label: "Issues", count: data.issues.filter((i: any) => i.status === "OPEN").length },
            { id: "details", label: "Details" },
          ]}
          value={tab} onChange={(t) => setParams((x) => { x.set("tab", t); return x; })} syncToUrl={false}
        />

        {tab === "stages" && (
          <StageView key={stage} stage={stage} data={data} canEdit={canEdit} canApprove={canApprove} upload={upload}
                     plantId={plantId} m={m} />
        )}
        {tab === "tests" && <TestsView data={data} canEdit={canEdit} upload={upload} m={m} products={products} />}
        {tab === "issues" && <IssuesView data={data} canEdit={canEdit} m={m} />}
        {tab === "details" && <DetailsView data={data} canEdit={canEdit} m={m} products={products} />}
      </div>
    </DashboardLayout>
  );
};

function OverrideButton({ onRelease }: { onRelease: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Release to mass production…</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="w-72" placeholder="Reason (e.g. already in production)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button disabled={!reason.trim()} onClick={() => { onRelease(reason.trim()); setOpen(false); }}>Release</Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Cancel"><X /></Button>
    </div>
  );
}

/* ---------------------------------------------------------------- stage view */

function StageView({ stage, data, canEdit, canApprove, upload, plantId, m }: any) {
  const { product: p, metrics: mx } = data;
  const rows = data.deliverables.filter((d: any) => d.plm_deliverable_template.stage === stage);
  const gate = data.gates.find((g: any) => g.gate === stage);
  const blockers: string[] | undefined = data.blockers[stage];
  const evt = data.tests.filter((t: any) => t.phase === "EVT");
  const svt = data.tests.filter((t: any) => t.phase === "SVT");
  const cost = mx.cost as any[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>{stageLabel(stage)}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* What the ERP measures for this stage */}
          <div className="flex flex-wrap gap-2">
            {(stage === 1 || stage === 5 || stage === 6) && cost.map((c) => (
              <Metric key={c.part_id} label={`Material cost ${c.part_code}`} value={`₹${Number(c.cost).toLocaleString("en-IN")}`}
                      hint={[p.target_cost != null && `target ₹${Number(p.target_cost).toLocaleString("en-IN")}`, c.unpriced > 0 && `${c.unpriced} line(s) without price`, c.foreign > 0 && `${c.foreign} in foreign currency, not added`].filter(Boolean).join(" · ")}
                      bad={p.target_cost != null && c.cost > p.target_cost} />
            ))}
            {(stage === 2 || stage === 4) && (
              <Metric label="BOM complete" value={`${mx.bom_pct}%`} hint={`${mx.bom_done} of ${mx.bom_lines} lines`} bad={mx.bom_pct <= (stage === 2 ? 70 : 95)} />
            )}
            {stage === 4 && <Metric label="Spec sheets" value={`${mx.spec_pct}%`} hint="of purchased lines" />}
            {stage === 3 && <Metric label="EVT tests passed" value={`${mx.evt_pass}/${mx.evt_total}`} bad={mx.evt_pass < mx.evt_total} />}
            {stage === 4 && <Metric label="SVT tests passed" value={`${mx.svt_pass}/${mx.svt_total}`} bad={mx.svt_not_passed > 0} />}
            {(stage === 3 || stage === 4 || stage === 5) && <Metric label="Open issues" value={String(mx.open_issues)} bad={mx.open_issues > 0} />}
            {(stage === 3 || stage === 5) && <Metric label="BIS" value={BIS_STEPS.find(([k]) => k === p.bis_status)?.[1] ?? p.bis_status}
                                                     bad={stage === 5 && !["LETTER_RECEIVED", "NOT_REQUIRED"].includes(p.bis_status)} />}
          </div>

          {(stage === 1 || stage === 2) && <FinishedGoods data={data} canEdit={canEdit} m={m} />}
          {stage === 3 && <BisPanel data={data} canEdit={canEdit} upload={upload} m={m} />}
          {stage === 4 && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="plm-fw">Firmware version (frozen)</Label>
                <Input id="plm-fw" className="w-56" defaultValue={p.firmware_version ?? ""} disabled={!canEdit}
                       onBlur={(e) => e.target.value !== (p.firmware_version ?? "") && m.updateProduct.mutate({ id: p.id, firmware_version: e.target.value || null })} />
              </div>
            </div>
          )}
          {stage === 5 && <PilotPanel data={data} canEdit={canEdit} plantId={plantId} m={m} />}
          {(stage === 3 || stage === 4) && (stage === 3 ? evt : svt).length === 0 && (
            <p className="text-sm text-muted-foreground">No {stage === 3 ? "EVT" : "SVT"} tests yet. Add them on the Tests tab.</p>
          )}

          {/* Checklist */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deliverable</TableHead><TableHead className="w-28">Status</TableHead>
                  <TableHead>File</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableEmpty columns={6} message="No checklist items in this stage" /> : rows.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium whitespace-nowrap">{d.plm_deliverable_template.label}</TableCell>
                    <TableCell>
                      <select aria-label={`Status of ${d.plm_deliverable_template.label}`} className={cn(sel, "w-24",
                        d.status === "CLOSED" && "text-success", d.status === "WIP" && "text-warning")}
                        value={d.status} disabled={!canEdit} onChange={(e) => m.updateDeliverable.mutate({ id: d.id, status: e.target.value })}>
                        {DELIVERABLE_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <FileCell path={d.file_url} disabled={!canEdit} onUpload={async (f) => {
                        const path = await upload(d.key, f);
                        await m.updateDeliverable.mutateAsync({ id: d.id, file_url: path });
                      }} />
                    </TableCell>
                    <TableCell><Input className="h-8 w-32" defaultValue={d.owner ?? ""} disabled={!canEdit}
                      onBlur={(e) => e.target.value !== (d.owner ?? "") && m.updateDeliverable.mutate({ id: d.id, owner: e.target.value || null })} /></TableCell>
                    <TableCell><Input type="date" className="h-8 w-36" defaultValue={d.due_date ?? ""} disabled={!canEdit}
                      onBlur={(e) => e.target.value !== (d.due_date ?? "") && m.updateDeliverable.mutate({ id: d.id, due_date: e.target.value || null })} /></TableCell>
                    <TableCell><Input className="h-8 min-w-[180px]" defaultValue={d.note ?? ""} disabled={!canEdit}
                      onBlur={(e) => e.target.value !== (d.note ?? "") && m.updateDeliverable.mutate({ id: d.id, note: e.target.value || null })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {stage < 6 && <GateCard stage={stage} p={p} gate={gate} blockers={blockers} canEdit={canEdit} canApprove={canApprove} upload={upload} m={m} />}
    </div>
  );
}

function GateCard({ stage, p, gate, blockers, canEdit, canApprove, upload, m }: any) {
  const [by, setBy] = useState(p.client ? `${p.client}` : "Harish");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const isCurrent = p.stage === stage;
  const rule = STAGES[stage - 1].gate;
  const pass = async () => {
    const fileUrl = file ? await upload(`gate${stage}`, file) : undefined;
    m.passGate.mutate({ product: p.id, gate: stage, approvedBy: stage === 1 ? by : undefined, fileUrl, note });
  };
  return (
    <Card className={cn(gate ? "border-success/40" : isCurrent ? "border-warning/50" : "")}>
      <CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Gate {stage}:</span> <span>{rule}</span>
          {gate && <Badge variant="secondary" className="ml-auto">Passed {fmtDate(gate.passed_at)} · {HOW[gate.how]}</Badge>}
        </div>
        {gate && (gate.approved_by_name || gate.note || gate.file_url) && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {gate.approved_by_name && <span>Approved by {gate.approved_by_name}</span>}
            {gate.note && <span>{gate.note}</span>}
            {gate.file_url && <Button variant="ghost" size="sm" onClick={() => openPlmFile(gate.file_url)}><FileText className="h-4 w-4" /> Approval</Button>}
          </div>
        )}
        {!gate && !isCurrent && <p className="text-sm text-muted-foreground">Comes after stage {p.stage} is through.</p>}
        {!gate && isCurrent && (
          <>
            {blockers && blockers.length > 0 ? (
              <ul className="text-sm list-disc pl-5 space-y-0.5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : (
              <p className="text-sm text-success">Everything this gate needs is done.</p>
            )}
            {[2, 4].includes(stage) && <p className="text-xs text-muted-foreground">This gate passes by itself as soon as the list above is empty.</p>}
            {stage === 1 && canEdit && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
                <div className="space-y-1"><Label htmlFor="g1-by">Sample &amp; cost approved by</Label>
                  <Input id="g1-by" value={by} onChange={(e) => setBy(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="g1-note">Note</Label>
                  <Input id="g1-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. mail of 12 Sep, cost ₹1,450" /></div>
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-md border px-3 text-sm">
                  <Paperclip className="h-4 w-4" /> {file ? file.name.slice(0, 18) : "Approval file"}
                  <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <Button disabled={!by.trim() || (blockers?.length ?? 0) > 0} onClick={pass}>Record approval</Button>
              </div>
            )}
            {stage === 3 && canEdit && (
              <Button disabled={(blockers?.length ?? 0) > 0} onClick={pass}>Sign off EVT</Button>
            )}
            {stage === 5 && (canApprove ? (
              <div className="flex flex-wrap gap-2 items-end">
                <Input className="w-80" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (customer PP exit reference)" />
                <Button disabled={(blockers?.length ?? 0) > 0} onClick={pass}>Release to mass production</Button>
              </div>
            ) : <p className="text-xs text-muted-foreground">Management releases the product once the list is empty.</p>)}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FinishedGoods({ data, canEdit, m }: any) {
  const { product: p } = data;
  const [pick, setPick] = useState("");
  const { data: fgs = [] } = useQuery({
    queryKey: ["plm-fg-candidates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("parts").select("id, part_code, name, plm_product_id")
        .eq("source_type", "FINISHED_GOOD").eq("is_active", true).order("part_code");
      if (error) throw error;
      return data as any[];
    },
  });
  const free = fgs.filter((f) => !f.plm_product_id);
  const { data: baseFgs = [] } = useQuery({
    queryKey: ["plm-base-fgs", p.based_on_id],
    enabled: !!p.based_on_id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("parts").select("id, part_code").eq("plm_product_id", p.based_on_id).order("part_code");
      return (data ?? []) as any[];
    },
  });
  const [copyFrom, setCopyFrom] = useState("");
  useEffect(() => { if (!copyFrom && baseFgs[0]) setCopyFrom(baseFgs[0].id); }, [baseFgs, copyFrom]);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="font-medium text-sm">Finished-good codes of this product</div>
      <p className="text-xs text-muted-foreground">
        One code per brand (JA-06C-PH). Create it here and it is linked to this product; its BOM is built on that code, and
        its completeness drives gates 2 and 4.{p.kind === "VARIATION" ? " A variation can start its BOM from the base product's code." : ""}
      </p>
      {canEdit && (
        <Button size="sm" onClick={() => setCreating(true)}><Plus /> Create finished-good code</Button>
      )}
      <CreatePartDialog open={creating} onOpenChange={setCreating}
        forProduct={{ id: p.id, code: p.product_code, name: p.name, category: p.category, client: p.client, baseFgs }}
        onCreated={() => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("plm") })} />
      {data.fgs.length === 0 && <p className="text-sm text-muted-foreground">None linked yet.</p>}
      {data.fgs.map((f: any) => (
        <div key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono">{f.part_code}</span><span>{f.name}</span>
          {canEdit && <Button variant="ghost" size="sm" onClick={() => m.linkPart.mutate({ product: p.id, part: f.id, link: false })}>Unlink</Button>}
          {canEdit && p.kind === "VARIATION" && baseFgs.length > 0 && (
            <span className="flex items-center gap-1">
              <select aria-label="Copy BOM from" className={sel} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                {baseFgs.map((b) => <option key={b.id} value={b.id}>{b.part_code}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => m.copyBom.mutate({ from: copyFrom, to: f.id })}>Copy BOM from base</Button>
            </span>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select aria-label="Finished good to link" className={cn(sel, "min-w-[260px]")} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Or link an existing code…</option>
            {free.map((f) => <option key={f.id} value={f.id}>{f.part_code} — {f.name}</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={!pick} onClick={() => { m.linkPart.mutate({ product: p.id, part: pick, link: true }); setPick(""); }}>Link</Button>
          <Link className="text-sm underline-offset-2 hover:underline text-muted-foreground" to="/management/parts?tab=FINISHED">Open Finished Goods</Link>
        </div>
      )}
      {p.kind === "VARIATION" && baseFgs.length === 0 && p.based_on_id && (
        <p className="text-xs text-muted-foreground">The base product has no finished-good code linked, so there is no BOM to copy.</p>
      )}
    </div>
  );
}

function BisPanel({ data, canEdit, upload, m }: any) {
  const { product: p } = data;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="plm-bis">BIS certification</Label>
        <select id="plm-bis" className={cn(sel, "w-48")} value={p.bis_status} disabled={!canEdit}
                onChange={(e) => m.updateProduct.mutate({ id: p.id, bis_status: e.target.value })}>
          {BIS_STEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">BIS letter</div>
        <FileCell path={p.bis_letter_url} disabled={!canEdit} onUpload={async (f) => {
          const path = await upload("bis_letter", f);
          await m.updateProduct.mutateAsync({ id: p.id, bis_letter_url: path });
        }} />
      </div>
      <p className="text-xs text-muted-foreground basis-full">Carries through to Pilot Production: the product cannot be released until the letter is received.</p>
    </div>
  );
}

function PilotPanel({ data, canEdit, plantId, m }: any) {
  const { product: p, metrics: mx } = data;
  const [part, setPart] = useState(data.fgs[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="font-medium text-sm">Pilot build (PP voucher)</div>
      <p className="text-xs text-muted-foreground">
        A pilot voucher runs the real flow: store kit, line, hourly output, PQC and OQC. It needs no projection and is
        allowed only while the product is at stage 5.
      </p>
      {mx.pilot_vouchers.length > 0 && (
        <Table>
          <TableHeader><TableRow><TableHead>Voucher</TableHead><TableHead>Code</TableHead><TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Made</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {mx.pilot_vouchers.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.voucher_number}</TableCell><TableCell className="font-mono">{v.part_code}</TableCell>
                <TableCell className="text-right tabular-nums">{v.quantity}</TableCell><TableCell className="text-right tabular-nums">{v.produced ?? 0}</TableCell>
                <TableCell>{v.planned_date}</TableCell><TableCell>{String(v.status).replace(/_/g, " ").toLowerCase()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {canEdit && p.stage === 5 && (
        data.fgs.length === 0 ? <p className="text-sm text-muted-foreground">Link a finished-good code first (stage 2).</p> : (
          <div className="flex flex-wrap items-end gap-2">
            <select aria-label="Finished good" className={sel} value={part} onChange={(e) => setPart(e.target.value)}>
              {data.fgs.map((f: any) => <option key={f.id} value={f.id}>{f.part_code}</option>)}
            </select>
            <Input type="number" min="1" className="w-28" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button disabled={!part || !(Number(qty) > 0) || !plantId}
                    onClick={() => m.schedulePilot.mutate({ plant: plantId, part, qty: Number(qty), date })}>Create pilot voucher</Button>
          </div>
        )
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tests */

function TestsView({ data, canEdit, upload, m, products }: any) {
  const { product: p } = data;
  const [names, setNames] = useState<Record<string, string>>({ EVT: "", SVT: "" });
  const [copyFrom, setCopyFrom] = useState(p.based_on_id ?? "");
  return (
    <div className="space-y-4">
      {canEdit && data.tests.length === 0 && (
        <Card><CardContent className="pt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm">Start from another product's test list:</span>
          <select aria-label="Copy tests from" className={sel} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Choose a product…</option>
            {products.filter((x: any) => x.id !== p.id).map((x: any) => <option key={x.id} value={x.id}>{x.product_code} — {x.name}</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={!copyFrom} onClick={() => m.copyTests.mutate({ from: copyFrom, to: p.id })}>Copy tests</Button>
        </CardContent></Card>
      )}
      {(["EVT", "SVT"] as const).map((phase) => {
        const list = data.tests.filter((t: any) => t.phase === phase);
        return (
          <Card key={phase}>
            <CardHeader className="pb-2">
              <CardTitle>{phase === "EVT" ? "EVT · Engineering Validation (stage 3)" : "SVT · System Verification (stage 4)"}</CardTitle>
              <p className="text-sm text-muted-foreground">A test set to Fail opens an issue on this product by itself.</p>
            </CardHeader>
            <CardContent className="space-y-3 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Test</TableHead><TableHead className="w-28">Result</TableHead><TableHead>Report</TableHead>
                  <TableHead>Note</TableHead><TableHead>Tested</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {list.length === 0 ? <TableEmpty columns={6} message={`No ${phase} tests yet`} /> : list.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <select aria-label={`Result of ${t.name}`} disabled={!canEdit} value={t.result}
                          className={cn(sel, "w-24", t.result === "PASS" && "text-success", t.result === "FAIL" && "text-destructive")}
                          onChange={(e) => m.updateTest.mutate({ id: t.id, result: e.target.value })}>
                          <option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option>
                        </select>
                      </TableCell>
                      <TableCell><FileCell path={t.report_url} disabled={!canEdit} onUpload={async (f) => {
                        const path = await upload(`test_${phase}`, f); await m.updateTest.mutateAsync({ id: t.id, report_url: path });
                      }} /></TableCell>
                      <TableCell><Input className="h-8 min-w-[180px]" defaultValue={t.note ?? ""} disabled={!canEdit}
                        onBlur={(e) => e.target.value !== (t.note ?? "") && m.updateTest.mutate({ id: t.id, note: e.target.value || null })} /></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(t.tested_at)}</TableCell>
                      <TableCell>{canEdit && <Button variant="ghost" size="icon" aria-label={`Remove ${t.name}`} onClick={() => m.deleteTest.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {canEdit && (
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (!names[phase].trim()) return;
                  m.addTest.mutate({ product_id: p.id, phase, name: names[phase].trim(), sort: list.length + 1 });
                  setNames((n) => ({ ...n, [phase]: "" }));
                }}>
                  <Input placeholder={`Add an ${phase} test, e.g. ${phase === "EVT" ? "Max output power at 10% THD" : "Drop test 1 m"}`}
                         value={names[phase]} onChange={(e) => setNames((n) => ({ ...n, [phase]: e.target.value }))} />
                  <Button type="submit" variant="outline"><Plus /> Add</Button>
                </form>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- issues */

function IssuesView({ data, canEdit, m }: any) {
  const { product: p } = data;
  const [f, setF] = useState({ description: "", severity: "MEDIUM", owner: "", action: "", target_date: "", stage: String(Math.min(p.stage, 6)) });
  return (
    <Card>
      <CardContent className="pt-5 space-y-3 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Stage</TableHead><TableHead>Description</TableHead><TableHead>Severity</TableHead>
            <TableHead>Owner</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.issues.length === 0 ? <TableEmpty columns={8} message="No issues" /> : data.issues.map((i: any) => (
              <TableRow key={i.id} className={i.status === "CLOSED" ? "opacity-60" : ""}>
                <TableCell className="font-mono whitespace-nowrap">{i.issue_no}
                  <div className="text-xs text-muted-foreground">{i.source === "TEST" ? "failed test" : i.source === "COMPLAINT" ? "complaint" : ""}</div></TableCell>
                <TableCell>{i.stage}</TableCell>
                <TableCell className="min-w-[240px]">{i.description}</TableCell>
                <TableCell><Badge variant={priorityVariant(i.severity)}>{i.severity.toLowerCase()}</Badge></TableCell>
                <TableCell><Input className="h-8 w-28" defaultValue={i.owner ?? ""} disabled={!canEdit}
                  onBlur={(e) => e.target.value !== (i.owner ?? "") && m.updateIssue.mutate({ id: i.id, owner: e.target.value || null })} /></TableCell>
                <TableCell><Input className="h-8 min-w-[160px]" defaultValue={i.action ?? ""} disabled={!canEdit}
                  onBlur={(e) => e.target.value !== (i.action ?? "") && m.updateIssue.mutate({ id: i.id, action: e.target.value || null })} /></TableCell>
                <TableCell><Input type="date" className="h-8 w-36" defaultValue={i.target_date ?? ""} disabled={!canEdit}
                  onBlur={(e) => e.target.value !== (i.target_date ?? "") && m.updateIssue.mutate({ id: i.id, target_date: e.target.value || null })} /></TableCell>
                <TableCell>
                  <select aria-label={`Status of ${i.issue_no}`} className={sel} value={i.status} disabled={!canEdit}
                          onChange={(e) => m.updateIssue.mutate({ id: i.id, status: e.target.value })}>
                    <option value="OPEN">Open</option><option value="CLOSED">Closed</option>
                  </select>
                  {i.closed_on && <div className="text-xs text-muted-foreground">{fmtDate(i.closed_on)}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <form className="grid gap-2 md:grid-cols-[2fr_auto_auto_1fr_1fr_auto_auto] items-end" onSubmit={(e) => {
            e.preventDefault();
            if (!f.description.trim()) return;
            m.addIssue.mutate({ product_id: p.id, stage: Number(f.stage), description: f.description.trim(), severity: f.severity,
              owner: f.owner || null, action: f.action || null, target_date: f.target_date || null });
            setF({ ...f, description: "", owner: "", action: "", target_date: "" });
          }}>
            <Input placeholder="Raise an issue: what is wrong" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <select aria-label="Stage" className={sel} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
              {STAGES.map((s) => <option key={s.n} value={s.n}>Stage {s.n}</option>)}
            </select>
            <select aria-label="Severity" className={sel} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
              <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
            <Input placeholder="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
            <Input placeholder="Action" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
            <Input type="date" aria-label="Target date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} />
            <Button type="submit"><Plus /> Raise</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- details */

function DetailsView({ data, canEdit, m, products }: any) {
  const { product: p } = data;
  const [f, setF] = useState({ ...p, target_cost: p.target_cost ?? "" });
  const { names, customers } = useClientNames(products);
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const save = () => {
    if (f.kind === "VARIATION" && !f.based_on_id) return toast.error("Choose the product this variation is based on");
    const client = (f.client ?? "").trim();
    m.updateProduct.mutate({
      id: p.id, product_code: f.product_code, name: f.name, category: f.category || null, kind: f.kind,
      based_on_id: f.kind === "VARIATION" ? f.based_on_id : null, client: client || null,
      customer_id: customers.find((c) => c.name === client)?.id ?? null, ownership: f.ownership,
      business_model: f.business_model || null, priority: f.priority, status: f.status,
      start_date: f.start_date || null, target_launch: f.target_launch || null,
      target_cost: f.target_cost === "" ? null : Number(f.target_cost), notes: f.notes || null,
    });
  };
  const field = (id: string, label: string, el: JSX.Element) => (
    <div className="space-y-1"><Label htmlFor={id}>{label}</Label>{el}</div>
  );
  const full = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field("d-code", "Product ID", <Input id="d-code" value={f.product_code} onChange={(e) => set({ product_code: e.target.value.toUpperCase() })} />)}
          {field("d-name", "Product name", <Input id="d-name" value={f.name} onChange={(e) => set({ name: e.target.value })} />)}
          {field("d-kind", "Type", (
            <select id="d-kind" className={full} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="NEW_MODEL">New model</option><option value="VARIATION">Variation of an existing product</option>
            </select>))}
          {f.kind === "VARIATION" && field("d-base", "Based on", (
            <select id="d-base" className={full} value={f.based_on_id ?? ""} onChange={(e) => set({ based_on_id: e.target.value })}>
              <option value="">Choose…</option>
              {products.filter((x: any) => x.id !== p.id).map((x: any) => <option key={x.id} value={x.id}>{x.product_code} — {x.name}</option>)}
            </select>))}
          {field("d-client", "Client (blank = Grammy)", <>
            <Input id="d-client" list="d-client-list" value={f.client ?? ""} onChange={(e) => set({ client: e.target.value })} />
            <datalist id="d-client-list">{names.map((n) => <option key={n} value={n} />)}</datalist></>)}
          {field("d-cat", "Category", <>
            <Input id="d-cat" list="d-cat-list" value={f.category ?? ""} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="d-cat-list">{PLM_CATEGORIES.map((n) => <option key={n} value={n} />)}</datalist></>)}
          {field("d-own", "Design owned by", (
            <select id="d-own" className={full} value={f.ownership} onChange={(e) => set({ ownership: e.target.value })}>
              <option value="GRAMMY">Grammy</option><option value="CLIENT">Client</option></select>))}
          {field("d-bm", "Business model", (
            <select id="d-bm" className={full} value={f.business_model ?? ""} onChange={(e) => set({ business_model: e.target.value })}>
              <option value="">—</option><option value="ODM">ODM</option><option value="OEM">OEM</option></select>))}
          {field("d-pri", "Priority", (
            <select id="d-pri" className={full} value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>))}
          {field("d-status", "Status", (
            <select id="d-status" className={full} value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="DROPPED">Dropped</option></select>))}
          {field("d-start", "Start date", <Input id="d-start" type="date" value={f.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value })} />)}
          {field("d-launch", "Target launch", <Input id="d-launch" type="date" value={f.target_launch ?? ""} onChange={(e) => set({ target_launch: e.target.value })} />)}
          {field("d-cost", "Target cost (₹ per unit)", <Input id="d-cost" type="number" min="0" step="any" value={f.target_cost} onChange={(e) => set({ target_cost: e.target.value })} />)}
          <div className="sm:col-span-2 lg:col-span-3">
            {field("d-notes", "Remarks", <Textarea id="d-notes" rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />)}
          </div>
        </fieldset>
        {canEdit && <div className="flex justify-end"><Button onClick={save}>Save details</Button></div>}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="font-medium text-foreground">Gate history</div>
          {data.gates.length === 0 ? <div>No gate passed yet.</div> : data.gates.map((g: any) => (
            <div key={g.id}>Gate {g.gate} → stage {g.gate + 1}: {fmtDate(g.passed_at)}, {HOW[g.how]}{g.approved_by_name ? `, approved by ${g.approved_by_name}` : ""}{g.note ? ` — ${g.note}` : ""}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default PLMProduct;
