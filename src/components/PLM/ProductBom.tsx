import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import { BOM_STEPS, type PlmBomLine, linePct } from "@/hooks/usePLM";
import { cn } from "@/lib/utils";

const sel = "h-8 rounded-md border border-input bg-background px-2 text-sm";
const CHANGE_LABEL: Record<string, string> = { NEW: "new", CARRY_OVER: "carry-over", CHANGED: "changed" };

export type PickPart = { id: string; part_code: string; name: string; uom: string | null; category: string; branding_required?: boolean; brand_relevant?: boolean };

/** Every part that can go into a BOM (not finished goods, not brand versions), for pickers. */
export const usePickParts = () =>
  useQuery({
    queryKey: ["plm-pick-parts"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: PickPart[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from("parts")
          .select("id, part_code, name, uom, category, branding_required, brand_relevant")
          .eq("is_active", true).neq("source_type", "FINISHED_GOOD").is("branded_from", null)
          .order("part_code").range(from, from + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });

/** Text box with the part list as suggestions; resolves "B-121 — EPS" to the part. */
export function PartPicker({ parts, value, onPick, placeholder, id }: {
  parts: PickPart[]; value?: string; onPick: (p: PickPart | null, text: string) => void; placeholder?: string; id: string;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <>
      <Input id={id} list={`${id}-list`} className="h-8" placeholder={placeholder ?? "Part code or name"} value={text}
             onChange={(e) => {
               setText(e.target.value);
               const code = e.target.value.split(" — ")[0].trim().toUpperCase();
               onPick(parts.find((p) => p.part_code === code) ?? null, e.target.value);
             }} />
      <datalist id={`${id}-list`}>
        {text.length >= 1 && parts.filter((p) => `${p.part_code} ${p.name}`.toLowerCase().includes(text.toLowerCase().split(" — ")[0]))
          .slice(0, 60).map((p) => <option key={p.id} value={`${p.part_code} — ${p.name}`} />)}
      </datalist>
    </>
  );
}

/**
 * The product's development BOM. Each line moves Design -> Sample -> Approval ->
 * Release (25% each); the product's BOM progress is their average and drives
 * gates 2, 4 and 5. `focus` shows only lines still short of release.
 */
export function ProductBom({ data, canEdit, m, focus = false, title }: {
  data: any; canEdit: boolean; m: any; focus?: boolean; title?: string;
}) {
  const { product: p } = data;
  const lines: PlmBomLine[] = data.bom;
  const testsBy = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of data.tests.filter((t: any) => t.phase === "PART")) map.set(t.bom_line_id, [...(map.get(t.bom_line_id) ?? []), t]);
    return map;
  }, [data.tests]);
  const [onlyOpen, setOnlyOpen] = useState(focus);
  const [open, setOpen] = useState<string | null>(null);
  const shown = onlyOpen ? lines.filter((l) => !l.release_done) : lines;
  const { data: parts = [] } = usePickParts();
  const dev = data.metrics.dev_bom;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {title && <div className="font-medium">{title}</div>}
        <div className="flex items-center gap-2 min-w-[220px]">
          <div className="h-2 w-40 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${dev?.pct ?? 0}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">{dev?.pct ?? 0}%</span>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {dev?.lines ?? 0} lines · closed: design {dev?.design ?? 0} · sample {dev?.sample ?? 0} · approval {dev?.approval ?? 0} · release {dev?.release ?? 0}
          {dev?.no_code ? ` · ${dev.no_code} without part code` : ""}
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={onlyOpen} onCheckedChange={(c) => setOnlyOpen(Boolean(c))} /> Only parts not released
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Part</TableHead>
              <TableHead className="text-right">QPS</TableHead>
              {BOM_STEPS.map(([, l]) => <TableHead key={l} className="text-center w-[84px]">{l}</TableHead>)}
              <TableHead className="text-right w-16">Done</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableEmpty columns={canEdit ? 10 : 9} message={lines.length ? "Every part is released" : "No BOM yet"} />
            ) : shown.map((l) => {
              const tests = testsBy.get(l.id) ?? [];
              const pct = linePct(l);
              return (
                <Fragment key={l.id}>
                  <TableRow className={cn(l.release_done && "bg-success/5")}>
                    <TableCell className="px-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Details" onClick={() => setOpen(open === l.id ? null : l.id)}>
                        {open === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="min-w-[240px]">
                      {l.part ? (
                        <div><span className="font-mono text-sm">{l.part.part_code}</span> {l.part.name}</div>
                      ) : (
                        <div className="italic">{l.description} <span className="not-italic text-xs text-warning">· no part code yet</span></div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <Badge variant={l.change_type === "CARRY_OVER" ? "secondary" : l.change_type === "CHANGED" ? "warning" : "outline"} className="text-[10px]">
                          {CHANGE_LABEL[l.change_type]}
                        </Badge>
                        {l.replaces && <span className="text-xs text-muted-foreground">replaces {l.replaces.part_code}</span>}
                        {l.is_critical && <Badge variant="destructive" className="text-[10px]">critical</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <Input type="number" min="0" step="any" className="h-8 w-20 ml-auto text-right" aria-label="Quantity per set"
                               defaultValue={l.bulk ? "" : l.quantity ?? ""} placeholder={l.bulk ? "bulk" : ""} disabled={l.bulk}
                               onBlur={(e) => e.target.value !== String(l.quantity ?? "") && m.updateBomLine.mutate({ id: l.id, quantity: e.target.value === "" ? null : Number(e.target.value) })} />
                      ) : <span className="tabular-nums">{l.bulk ? "bulk" : l.quantity}</span>}
                      <div className="text-[11px] text-muted-foreground">{l.part?.uom ?? ""}</div>
                    </TableCell>
                    {BOM_STEPS.map(([k, label]) => {
                      const v = (l as any)[k] as string;
                      return (
                        <TableCell key={k} className="text-center px-1">
                          <select aria-label={`${label} status`} disabled={!canEdit} value={v}
                                  className={cn("h-8 w-[76px] rounded-md border px-1 text-xs font-medium",
                                    v === "CLOSED" && "border-success/40 bg-success/10 text-success",
                                    v === "WIP" && "border-warning/40 bg-warning/10 text-warning",
                                    v === "OPEN" && "border-input bg-background text-muted-foreground")}
                                  onChange={(e) => m.updateBomLine.mutate({ id: l.id, [k]: e.target.value })}>
                            <option value="OPEN">Open</option><option value="WIP">WIP</option><option value="CLOSED">Closed</option>
                          </select>
                        </TableCell>
                      );
                    })}
                    <TableCell className={cn("text-right tabular-nums font-medium", pct === 100 && "text-success")}>{pct}%</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {tests.length ? <span className={cn(tests.some((t) => t.result === "FAIL") && "text-destructive")}>
                        {tests.filter((t) => t.result === "PASS").length}/{tests.length}</span> : "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove line"
                                onClick={() => m.deleteBomLine.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {open === l.id && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={canEdit ? 9 : 8}>
                        <LineDetails line={l} tests={tests} canEdit={canEdit} m={m} parts={parts} productId={p.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {canEdit && <AddLine productId={p.id} parts={parts} m={m} next={lines.length + 1} />}
    </div>
  );
}

function LineDetails({ line: l, tests, canEdit, m, parts, productId }: any) {
  const [testName, setTestName] = useState("");
  const [pick, setPick] = useState<PickPart | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2 py-2">
      <div className="space-y-2">
        {!l.part && canEdit && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Part code (needed before Release)</div>
            <div className="flex gap-2">
              <PartPicker id={`code-${l.id}`} parts={parts} onPick={(p) => setPick(p)} placeholder="Choose the part created for this line" />
              <Button size="sm" variant="outline" disabled={!pick} onClick={() => m.updateBomLine.mutate({ id: l.id, part_id: pick!.id })}>Set</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">Vendor / sample source
            <Input className="h-8" defaultValue={l.vendor_note ?? ""} disabled={!canEdit}
                   onBlur={(e) => e.target.value !== (l.vendor_note ?? "") && m.updateBomLine.mutate({ id: l.id, vendor_note: e.target.value || null })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Quoted price (₹)
            <Input className="h-8" type="number" min="0" step="any" defaultValue={l.quoted_price ?? ""} disabled={!canEdit}
                   onBlur={(e) => e.target.value !== String(l.quoted_price ?? "") && m.updateBomLine.mutate({ id: l.id, quoted_price: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">Remarks
          <Input className="h-8" defaultValue={l.remarks ?? ""} disabled={!canEdit}
                 onBlur={(e) => e.target.value !== (l.remarks ?? "") && m.updateBomLine.mutate({ id: l.id, remarks: e.target.value || null })} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={l.is_critical} disabled={!canEdit}
            onCheckedChange={(c) => m.updateBomLine.mutate({ id: l.id, is_critical: Boolean(c) })} /> Critical</label>
          <label className="flex items-center gap-2"><Checkbox checked={l.bulk} disabled={!canEdit}
            onCheckedChange={(c) => m.updateBomLine.mutate({ id: l.id, bulk: Boolean(c), ...(c ? { quantity: null } : {}) })} /> Issued in bulk</label>
          {l.part && l.part.approval_status !== "APPROVED" && <span className="text-warning">Part code waiting for approval</span>}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Part tests</div>
        <p className="text-xs text-muted-foreground">Approval can close only when every test of this part has passed. A failed test opens an issue and puts Approval back to WIP.</p>
        {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests on this part.</p>}
        {tests.map((t: any) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2">
            <span className="text-sm flex-1 min-w-[140px]">{t.name}</span>
            <select aria-label={`Result of ${t.name}`} className={cn(sel, t.result === "PASS" && "text-success", t.result === "FAIL" && "text-destructive")}
                    disabled={!canEdit} value={t.result} onChange={(e) => m.updateTest.mutate({ id: t.id, result: e.target.value })}>
              <option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option>
            </select>
            <Input className="h-8 w-44" placeholder="Note" defaultValue={t.note ?? ""} disabled={!canEdit}
                   onBlur={(e) => e.target.value !== (t.note ?? "") && m.updateTest.mutate({ id: t.id, note: e.target.value || null })} />
            {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove test" onClick={() => m.deleteTest.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        ))}
        {canEdit && (
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault(); if (!testName.trim()) return;
            m.addTest.mutate({ product_id: productId, phase: "PART", bom_line_id: l.id, name: testName.trim() });
            setTestName("");
          }}>
            <Input className="h-8" placeholder="Add a test, e.g. Frequency response, Print rub test" value={testName} onChange={(e) => setTestName(e.target.value)} />
            <Button type="submit" size="sm" variant="outline"><Plus /> Add</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function AddLine({ productId, parts, m, next }: { productId: string; parts: PickPart[]; m: any; next: number }) {
  const [pick, setPick] = useState<PickPart | null>(null);
  const [text, setText] = useState("");
  const [qty, setQty] = useState("1");
  const [k, setK] = useState(0);
  const add = () => {
    if (!pick && !text.trim()) return;
    m.addBomLine.mutate({ product_id: productId, part_id: pick?.id ?? null, description: pick ? null : text.trim(),
                          quantity: Number(qty) || null, change_type: "NEW", sort: next });
    setPick(null); setText(""); setQty("1"); setK(k + 1);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[280px]" key={k}>
        <PartPicker id="plm-add-line" parts={parts} onPick={(p, t) => { setPick(p); setText(t); }}
                    placeholder="Add a part: type a code, or describe a new part (e.g. 8in woofer 4 ohm)" />
      </div>
      <Input type="number" min="0" step="any" className="h-8 w-24" aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Button size="sm" onClick={add} disabled={!pick && !text.trim()}><Plus /> {pick ? `Add ${pick.part_code}` : "Add new part"}</Button>
    </div>
  );
}

/** Suggested changes when a product is made for another brand. */
const likelyChange = (p?: PickPart | null) =>
  !!p && (p.category === "B" || p.category === "S" || !!p.branding_required || !!p.brand_relevant || /logo|manual|qsg|gift box|carton/i.test(p.name));

/**
 * A variation's first BOM: the base product's BOM, each line Keep / Change / Remove.
 * Brand-related lines (packaging, stickers, printed parts, logo, manual) are
 * pre-marked Change.
 */
export function BaseBomPicker({ baseLines, baseCode, onSubmit, busy }: {
  baseLines: PlmBomLine[]; baseCode: string; onSubmit: (actions: any[]) => void; busy?: boolean;
}) {
  const { data: parts = [] } = usePickParts();
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const [act, setAct] = useState<Record<string, { action: string; part_id?: string; description?: string }>>({});
  const get = (l: PlmBomLine) => act[l.id] ?? { action: likelyChange(byId.get(l.part_id ?? "")) ? "CHANGE" : "KEEP" };
  const set = (id: string, v: any) => setAct((a) => ({ ...a, [id]: { ...(a[id] ?? get(baseLines.find((x) => x.id === id)!)), ...v } }));
  const counts = baseLines.reduce((c, l) => ({ ...c, [get(l).action]: (c[get(l).action] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {baseCode}'s BOM, line by line. Keep what stays the same (carry-over, already released). Mark what changes for this
        product: pick the replacement part if it exists, or leave it blank and a new-part line is made for R&amp;D to develop.
        Packaging, stickers, printed parts, logo and manual are marked Change to start with.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Part in {baseCode}</TableHead><TableHead className="text-right">QPS</TableHead>
            <TableHead>Keep / Change / Remove</TableHead><TableHead>Replacement (optional)</TableHead></TableRow></TableHeader>
          <TableBody>
            {baseLines.map((l) => {
              const a = get(l);
              return (
                <TableRow key={l.id} className={cn(a.action === "CHANGE" && "bg-warning/5", a.action === "REMOVE" && "opacity-50")}>
                  <TableCell className="min-w-[220px]">{l.part ? <><span className="font-mono text-sm">{l.part.part_code}</span> {l.part.name}</> : <i>{l.description}</i>}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.bulk ? "bulk" : l.quantity}</TableCell>
                  <TableCell>
                    <div className="flex gap-3 text-sm">
                      {[["KEEP", "Keep"], ["CHANGE", "Change"], ["REMOVE", "Remove"]].map(([v, t]) => (
                        <label key={v} className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" name={`act-${l.id}`} checked={a.action === v} onChange={() => set(l.id, { action: v })} /> {t}
                        </label>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[240px]">
                    {a.action === "CHANGE" && (
                      <PartPicker id={`rep-${l.id}`} parts={parts} placeholder="Existing part, or describe the new one"
                                  onPick={(p, t) => set(l.id, { part_id: p?.id ?? "", description: p ? "" : t })} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Keep {counts.KEEP ?? 0} · Change {counts.CHANGE ?? 0} · Remove {counts.REMOVE ?? 0}</span>
        <Button className="ml-auto" disabled={busy}
                onClick={() => onSubmit(baseLines.map((l) => ({ line_id: l.id, ...get(l) })))}>
          <Upload className="h-4 w-4" /> Create this product's BOM
        </Button>
      </div>
    </div>
  );
}
