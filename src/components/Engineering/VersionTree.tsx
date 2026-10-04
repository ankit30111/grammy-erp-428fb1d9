import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import { PartPicker, type PickPart, usePickParts } from "@/components/PLM/ProductBom";
import {
  BOM_STEPS, type IVersion, type VLine, linePct, useEngineeringMutations, useVersionTree, useWhereUsed,
} from "@/hooks/useEngineering";
import { cn } from "@/lib/utils";

const sel = "h-8 rounded-md border border-input bg-background px-2 text-sm";
const CHANGE_LABEL: Record<string, string> = { NEW: "new", CARRY_OVER: "carry-over", CHANGED: "changed" };
const fmt = (n: number) => (Math.round(n * 10000) / 10000).toString();
const COLS = 11;

export const versionLabel = (v?: IVersion | null) =>
  !v ? "" : `${v.item?.part_code ?? ""} v${v.version}${v.status === "DRAFT" ? " draft" : ""}${v.ecn ? ` · ${v.ecn.ecn_no}` : ""}`;

/**
 * R&D's BOM: a version as a tree. A sub-assembly line opens to the version of
 * the sub-assembly it uses, level by level, so every part of the product shows.
 *
 * A draft can be edited: quantity, brands, the four steps, add and remove.
 * Inside a released sub-assembly nothing changes until R&D chooses, on that
 * line, to change it for this product only (a new sub-assembly code) or for
 * every product using it (its next version, in the same ECN).
 */
export function VersionTree({ rootId, canEdit, onlyOpen = false, tests = [], testM, productId, brandOptions = [], dense = false }: {
  rootId: string; canEdit: boolean; onlyOpen?: boolean; tests?: any[]; testM?: any; productId?: string;
  brandOptions?: { letter: string; name: string }[]; dense?: boolean;
}) {
  const { data, isLoading } = useVersionTree(rootId);
  const m = useEngineeringMutations();
  const { data: parts = [] } = usePickParts();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<string | null>(null);
  const [changing, setChanging] = useState<{ line: VLine; root: IVersion } | null>(null);
  const testsBy = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tests.filter((t: any) => t.phase === "PART")) map.set(t.bom_line_id, [...(map.get(t.bom_line_id) ?? []), t]);
    return map;
  }, [tests]);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading the BOM…</p>;
  const { versions, lines, root } = data;

  // A line is "open" when it or anything inside it is not released yet.
  const hasOpen = (l: VLine, depth = 0): boolean =>
    !l.release_done || (depth < 8 && !!l.child_version_id && (lines.get(l.child_version_id) ?? []).some((c) => hasOpen(c, depth + 1)));
  const subCount = (vid: string): number =>
    (lines.get(vid) ?? []).filter((l) => l.child_version_id).length;

  const renderVersion = (vid: string, depth: number, perProduct: number | null): JSX.Element[] => {
    const v = versions.get(vid);
    const editable = canEdit && v?.status === "DRAFT";
    const rows: JSX.Element[] = [];
    const list = (lines.get(vid) ?? []).filter((l) => !onlyOpen || hasOpen(l));
    for (const l of list) {
      const qty = l.bulk ? null : Number(l.quantity ?? 0);
      const each = perProduct != null && qty != null ? perProduct * qty : null;
      const child = l.child_version_id ? versions.get(l.child_version_id) : undefined;
      const isOpen = !!open[l.id];
      const t = testsBy.get(l.id) ?? [];
      const pct = linePct(l);
      rows.push(
        <TableRow key={l.id} className={cn(depth > 0 && "bg-muted/30", l.release_done && depth === 0 && "bg-success/5")}>
          <TableCell className="px-1 w-8">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Details" onClick={() => setDetails(details === l.id ? null : l.id)}>
              {details === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </TableCell>
          <TableCell className="min-w-[260px]">
            <div style={{ paddingLeft: depth * 20 }} className={cn(depth > 0 && "border-l-2 border-primary/30 pl-2")}>
              {l.part ? (
                <div><span className="font-mono text-sm">{l.part.part_code}</span> {l.part.name}</div>
              ) : (
                <div className="italic">{l.description} <span className="not-italic text-xs text-warning">· no part code yet</span></div>
              )}
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                <Badge variant={l.change_type === "CARRY_OVER" ? "secondary" : l.change_type === "CHANGED" ? "warning" : "outline"} className="text-[10px]">
                  {CHANGE_LABEL[l.change_type]}
                </Badge>
                {l.replaces && <span className="text-xs text-muted-foreground">replaces {l.replaces.part_code}</span>}
                {l.is_critical && <Badge variant="destructive" className="text-[10px]">critical</Badge>}
                {child && (
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {isOpen ? "Hide" : "Show"} {(lines.get(child.id) ?? []).length} parts inside · v{child.version}{child.status === "DRAFT" ? " draft" : ""}
                  </button>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="text-right">
            {editable ? (
              <Input type="number" min="0" step="any" className="h-8 w-20 ml-auto text-right" aria-label="Quantity per set"
                     defaultValue={l.bulk ? "" : l.quantity ?? ""} placeholder={l.bulk ? "bulk" : ""} disabled={l.bulk}
                     onBlur={(e) => e.target.value !== String(l.quantity ?? "") && m.updateLine.mutate({ id: l.id, quantity: e.target.value === "" ? null : Number(e.target.value) })} />
            ) : <span className="tabular-nums">{l.bulk ? "bulk" : fmt(Number(l.quantity ?? 0))}</span>}
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {l.part?.uom ?? ""}{depth > 0 && each != null ? ` · ${fmt(each)} per product` : ""}
            </div>
          </TableCell>
          <TableCell>
            <BrandCell line={l} editable={editable} options={brandOptions} onSave={(brands) => m.updateLine.mutate({ id: l.id, brands })} />
          </TableCell>
          {BOM_STEPS.map(([k, label]) => {
            const s = (l as any)[k] as string;
            return (
              <TableCell key={k} className="text-center px-1">
                <select aria-label={`${label} status`} disabled={!editable} value={s}
                        className={cn("h-8 w-[76px] rounded-md border px-1 text-xs font-medium",
                          s === "CLOSED" && "border-success/40 bg-success/10 text-success",
                          s === "WIP" && "border-warning/40 bg-warning/10 text-warning",
                          s === "OPEN" && "border-input bg-background text-muted-foreground")}
                        onChange={(e) => m.updateLine.mutate({ id: l.id, [k]: e.target.value } as any)}>
                  <option value="OPEN">Open</option><option value="WIP">WIP</option><option value="CLOSED">Closed</option>
                </select>
              </TableCell>
            );
          })}
          <TableCell className={cn("text-right tabular-nums font-medium", pct === 100 && "text-success")}>{pct}%</TableCell>
          <TableCell className="text-right tabular-nums text-sm">
            {t.length ? <span className={cn(t.some((x) => x.result === "FAIL") && "text-destructive")}>{t.filter((x) => x.result === "PASS").length}/{t.length}</span> : "—"}
          </TableCell>
          <TableCell className="px-1 w-10">
            {editable && (
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove line"
                      onClick={() => { if (window.confirm(`Remove ${l.part?.part_code ?? l.description} from this draft?`)) m.deleteLine.mutate(l.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </TableCell>
        </TableRow>,
      );
      if (details === l.id) {
        rows.push(
          <TableRow key={`${l.id}-d`}>
            <TableCell />
            <TableCell colSpan={COLS - 1}>
              <LineDetails line={l} tests={t} canEdit={editable} m={m} testM={testM} parts={parts} productId={productId} />
            </TableCell>
          </TableRow>,
        );
      }
      if (child && isOpen) {
        const childEditable = canEdit && child.status === "DRAFT";
        rows.push(
          <TableRow key={`${l.id}-h`} className="bg-muted/50">
            <TableCell />
            <TableCell colSpan={COLS - 1} className="py-1.5">
              <div style={{ paddingLeft: (depth + 1) * 20 }} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">Inside {child.item?.part_code} · v{child.version}</span>
                {child.status === "DRAFT"
                  ? <Badge variant="warning" className="text-[10px]">draft{child.ecn ? ` · ${child.ecn.ecn_no}` : ""}</Badge>
                  : <span className="text-muted-foreground">released</span>}
                {editable && child.status === "RELEASED" && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setChanging({ line: l, root })}>
                    <GitBranch className="h-3.5 w-3.5" /> Change inside {child.item?.part_code}
                  </Button>
                )}
                {!editable && child.status === "RELEASED" && canEdit && root.status === "RELEASED" && (
                  <span className="text-muted-foreground">Raise an ECN to change it</span>
                )}
              </div>
            </TableCell>
          </TableRow>,
        );
        rows.push(...renderVersion(child.id, depth + 1, each ?? (qty ?? null)));
        if (childEditable) {
          rows.push(
            <TableRow key={`${l.id}-add`} className="bg-muted/30">
              <TableCell />
              <TableCell colSpan={COLS - 1}>
                <div style={{ paddingLeft: (depth + 1) * 20 }}>
                  <AddLine versionId={child.id} parts={parts} m={m} next={(lines.get(child.id) ?? []).length + 1} label={`Add a part inside ${child.item?.part_code}`} />
                </div>
              </TableCell>
            </TableRow>,
          );
        }
      }
    }
    return rows;
  };

  const rootLines = lines.get(rootId) ?? [];
  const nSub = subCount(rootId);
  const editableRoot = canEdit && root.status === "DRAFT";

  return (
    <div className="space-y-3">
      {nSub > 0 && !dense && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="font-medium text-primary hover:underline"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    const walk = (vid: string, d: number) => {
                      for (const l of lines.get(vid) ?? []) if (l.child_version_id && d < 8) { all[l.id] = true; walk(l.child_version_id, d + 1); }
                    };
                    walk(rootId, 0);
                    const anyClosed = Object.keys(all).some((k) => !open[k]);
                    setOpen(anyClosed ? all : {});
                  }}>
            Open / close all {nSub} sub-assemblies
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Part</TableHead>
              <TableHead className="text-right">QPS</TableHead>
              <TableHead>Brands</TableHead>
              {BOM_STEPS.map(([, l]) => <TableHead key={l} className="text-center w-[84px]">{l}</TableHead>)}
              <TableHead className="text-right w-16">Done</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rootLines.length === 0
              ? <TableEmpty columns={COLS} message={editableRoot ? "No lines yet: add the first part below" : "No lines"} />
              : renderVersion(rootId, 0, 1)}
          </TableBody>
        </Table>
      </div>
      {editableRoot && <AddLine versionId={rootId} parts={parts} m={m} next={rootLines.length + 1} />}
      {changing && <ChangeInsideDialog line={changing.line} root={changing.root} onClose={() => setChanging(null)} m={m} />}
    </div>
  );
}

/** Which brands a line is for: every brand, or some. */
function BrandCell({ line, editable, options, onSave }: {
  line: VLine; editable: boolean; options: { letter: string; name: string }[]; onSave: (b: string[] | null) => void;
}) {
  const label = line.brands?.length ? line.brands.join(", ") : "All";
  if (!editable) {
    return line.brands?.length
      ? <div className="flex flex-wrap gap-1">{line.brands.map((b) => <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>)}</div>
      : <span className="text-xs text-muted-foreground">All</span>;
  }
  const set = new Set(line.brands ?? []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-[64px] font-mono text-xs">{label}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-2" align="start">
        <div className="text-xs text-muted-foreground">This line is for…</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={!line.brands?.length} onCheckedChange={(c) => c && onSave(null)} /> Every brand
        </label>
        {options.map((b) => (
          <label key={b.letter} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={set.has(b.letter)} onCheckedChange={(c) => {
              const n = new Set(set); c ? n.add(b.letter) : n.delete(b.letter);
              onSave(n.size ? [...n].sort() : null);
            }} />
            {b.name} ({b.letter})
          </label>
        ))}
        {options.length === 0 && <p className="text-xs text-muted-foreground">Add brand codes to the model to choose brands here.</p>}
      </PopoverContent>
    </Popover>
  );
}

function ChangeInsideDialog({ line, root, onClose, m }: { line: VLine; root: IVersion; onClose: () => void; m: ReturnType<typeof useEngineeringMutations> }) {
  const { data: used = [] } = useWhereUsed(line.part_id);
  const others = used.filter((u) => u.item_id !== root.item_id);
  const code = line.part?.part_code ?? "";
  const go = async (scope: "THIS" | "ALL") => { await m.changeSubassembly.mutateAsync({ line: line.id, scope }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Change what is inside {code}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            {code} is also used in: {others.length ? <span className="font-mono">{others.map((u) => `${u.part_code} v${u.version}`).join(", ")}</span> : "nothing else"}.
          </p>
          <div className="rounded-md border p-3 space-y-2">
            <div className="font-medium">Only for {root.item?.part_code}</div>
            <p className="text-muted-foreground">{code} is copied to a new sub-assembly code for this product, and you change the copy. Other products keep {code} as it is.</p>
            <Button size="sm" variant="outline" disabled={m.changeSubassembly.isPending} onClick={() => go("THIS")}>New code for {root.item?.part_code}</Button>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <div className="font-medium">For every product using it</div>
            <p className="text-muted-foreground">
              {code} gets its next version in this ECN{others.length ? `, and ${others.map((u) => u.part_code).join(", ")} get a new version too, so each brand's records show the change` : ""}.
              It reaches production for all of them when the ECN is released.
            </p>
            <Button size="sm" disabled={!root.ecn_id || m.changeSubassembly.isPending} onClick={() => go("ALL")}>Change {code} everywhere</Button>
            {!root.ecn_id && <p className="text-xs text-warning">Only in an ECN: this first version is not released yet.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LineDetails({ line: l, tests, canEdit, m, testM, parts, productId }: any) {
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
              <Button size="sm" variant="outline" disabled={!pick} onClick={() => m.updateLine.mutate({ id: l.id, part_id: pick!.id })}>Set</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">Vendor / sample source
            <Input className="h-8" defaultValue={l.vendor_note ?? ""} disabled={!canEdit}
                   onBlur={(e) => e.target.value !== (l.vendor_note ?? "") && m.updateLine.mutate({ id: l.id, vendor_note: e.target.value || null })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Quoted price (₹)
            <Input className="h-8" type="number" min="0" step="any" defaultValue={l.quoted_price ?? ""} disabled={!canEdit}
                   onBlur={(e) => e.target.value !== String(l.quoted_price ?? "") && m.updateLine.mutate({ id: l.id, quoted_price: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">Remarks
          <Input className="h-8" defaultValue={l.remarks ?? ""} disabled={!canEdit}
                 onBlur={(e) => e.target.value !== (l.remarks ?? "") && m.updateLine.mutate({ id: l.id, remarks: e.target.value || null })} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={l.is_critical} disabled={!canEdit}
            onCheckedChange={(c) => m.updateLine.mutate({ id: l.id, is_critical: Boolean(c) })} /> Critical</label>
          <label className="flex items-center gap-2"><Checkbox checked={l.bulk} disabled={!canEdit}
            onCheckedChange={(c) => m.updateLine.mutate({ id: l.id, bulk: Boolean(c), ...(c ? { quantity: null } : {}) })} /> Issued in bulk</label>
          {l.part && l.part.approval_status !== "APPROVED" && <span className="text-warning">Part code waiting for approval</span>}
        </div>
      </div>
      {productId && testM && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Part tests</div>
          <p className="text-xs text-muted-foreground">Approval can close only when every test of this part has passed. A failed test opens an issue and puts Approval back to WIP.</p>
          {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests on this part.</p>}
          {tests.map((t: any) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="text-sm flex-1 min-w-[140px]">{t.name}</span>
              <select aria-label={`Result of ${t.name}`} className={cn(sel, t.result === "PASS" && "text-success", t.result === "FAIL" && "text-destructive")}
                      disabled={!canEdit} value={t.result} onChange={(e) => testM.updateTest.mutate({ id: t.id, result: e.target.value })}>
                <option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option>
              </select>
              <Input className="h-8 w-44" placeholder="Note" defaultValue={t.note ?? ""} disabled={!canEdit}
                     onBlur={(e) => e.target.value !== (t.note ?? "") && testM.updateTest.mutate({ id: t.id, note: e.target.value || null })} />
              {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove test" onClick={() => testM.deleteTest.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          {canEdit && (
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault(); if (!testName.trim()) return;
              testM.addTest.mutate({ product_id: productId, phase: "PART", bom_line_id: l.id, name: testName.trim() });
              setTestName("");
            }}>
              <Input className="h-8" placeholder="Add a test, e.g. Frequency response, Print rub test" value={testName} onChange={(e) => setTestName(e.target.value)} />
              <Button type="submit" size="sm" variant="outline"><Plus /> Add</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function AddLine({ versionId, parts, m, next, label }: { versionId: string; parts: PickPart[]; m: any; next: number; label?: string }) {
  const [pick, setPick] = useState<PickPart | null>(null);
  const [text, setText] = useState("");
  const [qty, setQty] = useState("1");
  const [k, setK] = useState(0);
  const add = () => {
    if (!pick && !text.trim()) return;
    m.addLine.mutate({ version_id: versionId, part_id: pick?.id ?? null, description: pick ? null : text.trim(),
                       quantity: Number(qty) || null, change_type: "NEW", sort: next });
    setPick(null); setText(""); setQty("1"); setK(k + 1);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[280px]" key={k}>
        <PartPicker id={`add-${versionId}`} parts={parts} onPick={(p, t) => { setPick(p); setText(t); }}
                    placeholder={label ? `${label}: code, or describe a new part` : "Add a part: type a code, or describe a new part (e.g. 8in woofer 4 ohm)"} />
      </div>
      <Input type="number" min="0" step="any" className="h-8 w-24" aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Button size="sm" onClick={add} disabled={!pick && !text.trim()}><Plus /> {pick ? `Add ${pick.part_code}` : "Add new part"}</Button>
    </div>
  );
}
