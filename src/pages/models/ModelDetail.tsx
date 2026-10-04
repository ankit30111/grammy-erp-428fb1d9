import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, GitBranch, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import { BOMBuilder } from "@/components/BOM/BOMBuilder";
import { usePermissions } from "@/hooks/usePermissions";
import { useBrands } from "@/hooks/usePartCategories";
import {
  type BrandRow, type ModelLine, type ModelVersion, type PartLite,
  brandMovePreview, compareBrand, diffVersions, latestReleased, useModel, useModelMutations, versionCmp,
} from "@/hooks/useModels";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const qtyText = (l?: { quantity: number | null; bulk?: boolean } | null, uom?: string | null) =>
  !l ? "—" : l.bulk ? "bulk" : `${Number(l.quantity)} ${(uom ?? "PCS").toUpperCase()}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

const ModelDetail = () => {
  const { code } = useParams();
  const { data, isLoading } = useModel(code);
  const { canEditMasters, canApprove } = usePermissions();
  const canEdit = canEditMasters || canApprove;
  const m = useModelMutations();
  const [editing, setEditing] = useState<ModelVersion | null>(null);
  const [ecn, setEcn] = useState<null | "ECN" | "MAJOR">(null);
  const [addBrand, setAddBrand] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (isLoading) return <DashboardLayout><p className="text-muted-foreground">Loading…</p></DashboardLayout>;
  if (!data) return <DashboardLayout><p>No model {code}. <Link className="underline" to="/models">All models</Link></p></DashboardLayout>;

  const { model, versions, brands, bom, parts } = data;
  const rel = latestReleased(versions);
  const draft = versions.find((v) => v.status === "DRAFT");

  if (editing) {
    const live = versions.find((v) => v.id === editing.id) ?? editing;
    return (
      <DashboardLayout>
        <BOMBuilder partId={model.id} onClose={() => setEditing(null)}
          draft={{
            title: `${model.part_code} v${live.version} (draft)`,
            lines: live.lines,
            saving: m.saveVersion.isPending,
            onSave: (lines) => m.saveVersion.mutateAsync({ id: live.id, lines }),
          }} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={`${model.part_code} — ${model.name}`}
        breadcrumb={[{ label: "Models", to: "/models" }, { label: model.part_code }]}
        actions={canEdit && (
          <Button variant="outline" size="sm" onClick={() => { setName(model.name); setRenaming(true); }}><Pencil /> Rename</Button>
        )}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{rel ? <>Released <span className="font-medium text-foreground">v{rel.version}</span></> : "No version released yet"}</span>
          {draft && <span>· In draft: <span className="font-medium text-foreground">v{draft.version}</span>{draft.ecn_no ? ` (${draft.ecn_no})` : ""}</span>}
          {model.plm && <span>· R&amp;D <Link className="font-mono underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(model.plm.product_code)}`}>{model.plm.product_code}</Link></span>}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Versions</CardTitle>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!rel || !!draft} onClick={() => setEcn("ECN")}
                          title={!rel ? "Release the first version first" : draft ? "Finish the draft first" : undefined}>
                    <GitBranch /> Raise ECN
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rel || !!draft} onClick={() => setEcn("MAJOR")}>Major redesign</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Versions versions={versions} brands={brands} parts={parts} canEdit={canEdit} canApprove={canApprove} m={m} onEdit={setEditing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Brands</CardTitle>
              {canEdit && <Button size="sm" onClick={() => setAddBrand(true)}><Plus /> Add brand</Button>}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Brands brands={brands} versions={versions} bom={bom} parts={parts} canApprove={canApprove} m={m} />
          </CardContent>
        </Card>
      </div>

      <EcnDialog kind={ecn} onClose={() => setEcn(null)} rel={rel} versions={versions}
        onSubmit={async (reason) => { await m.raiseEcn.mutateAsync({ model: model.id, reason, major: ecn === "MAJOR" }); setEcn(null); }} />
      <AddBrandDialog open={addBrand} onOpenChange={setAddBrand} modelCode={model.part_code} modelName={model.name}
        taken={brands.map((b) => b.brand)} version={rel?.version ?? versions[versions.length - 1]?.version}
        onSubmit={async (brand, nm) => { await m.addBrand.mutateAsync({ model: model.id, brand, name: nm }); setAddBrand(false); }} />
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rename {model.part_code}</DialogTitle></DialogHeader>
          <Input aria-label="Model name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button disabled={!name.trim()} onClick={async () => { await m.rename.mutateAsync({ id: model.id, name: name.trim() }); setRenaming(false); }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

function Versions({ versions, brands, parts, canEdit, canApprove, m, onEdit }: {
  versions: ModelVersion[]; brands: BrandRow[]; parts: Map<string, PartLite>; canEdit: boolean; canApprove: boolean;
  m: ReturnType<typeof useModelMutations>; onEdit: (v: ModelVersion) => void;
}) {
  const [open, setOpen] = useState<string | null>(versions.find((v) => v.status === "DRAFT")?.id ?? versions[0]?.id ?? null);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Version</TableHead><TableHead>Change</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Lines</TableHead><TableHead>Brands on it</TableHead><TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.length === 0 && <TableEmpty columns={7} message="No version yet" />}
        {versions.map((v) => {
          const on = brands.filter((b) => b.model_version === v.version);
          const isOpen = open === v.id;
          return (
            <Fragment key={v.id}>
              <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : v.id)}>
                <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                <TableCell className="font-mono font-medium">v{v.version}</TableCell>
                <TableCell className="min-w-[220px]">
                  {v.ecn_no && <span className="font-mono text-xs mr-2">{v.ecn_no}</span>}
                  {v.kind === "MAJOR" && <Badge variant="secondary" className="mr-2">redesign</Badge>}
                  <span className="text-sm">{v.reason ?? "—"}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {v.status === "RELEASED" ? <span className="text-sm">Released {fmtDate(v.released_at)}</span> : <Badge variant="warning">draft</Badge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{v.lines.length}</TableCell>
                <TableCell className="font-mono text-xs">{on.map((b) => b.part_code).join(", ") || "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-right">
                  {v.status === "DRAFT" && canEdit && <Button size="sm" variant="outline" onClick={() => onEdit(v)}>Edit BOM</Button>}
                  {v.status === "DRAFT" && canApprove && (
                    <Button size="sm" className="ml-2" disabled={m.release.isPending || v.lines.length === 0}
                            onClick={() => { if (window.confirm(`Release ${v.ecn_no ?? ""} v${v.version}? Its BOM is fixed from then on; brands move onto it one by one.`)) m.release.mutate(v.id); }}>
                      Release
                    </Button>
                  )}
                  {v.status === "DRAFT" && v.kind !== "INITIAL" && canEdit && (
                    <Button size="sm" variant="ghost" className="ml-1" onClick={() => { if (window.confirm(`Discard ${v.ecn_no}?`)) m.discard.mutate(v.id); }}>Discard</Button>
                  )}
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={6}>
                    {v.status === "DRAFT" && v.kind !== "INITIAL" && canEdit && <ReasonEdit v={v} m={m} />}
                    <VersionLines v={v} prev={versions.find((x) => x.id === v.based_on)} parts={parts} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReasonEdit({ v, m }: { v: ModelVersion; m: ReturnType<typeof useModelMutations> }) {
  const [r, setR] = useState(v.reason ?? "");
  useEffect(() => setR(v.reason ?? ""), [v.reason]);
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[260px] space-y-1">
        <Label htmlFor={`r-${v.id}`}>What changes and why ({v.ecn_no})</Label>
        <Input id={`r-${v.id}`} value={r} onChange={(e) => setR(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" disabled={r === (v.reason ?? "")} onClick={() => m.updateReason.mutate({ id: v.id, reason: r })}>Save reason</Button>
    </div>
  );
}

function VersionLines({ v, prev, parts }: { v: ModelVersion; prev?: ModelVersion; parts: Map<string, PartLite> }) {
  const d = prev ? diffVersions(prev.lines, v.lines) : null;
  const changed = new Map((d?.changed ?? []).map((c) => [c.to.child_part_id, c.from]));
  const added = new Set((d?.added ?? []).map((l) => l.child_part_id));
  const p = (id: string) => parts.get(id);
  const sorted = [...v.lines].sort((a, b) => (p(a.child_part_id)?.part_code ?? "").localeCompare(p(b.child_part_id)?.part_code ?? ""));
  return (
    <div className="space-y-2">
      {d && (
        <p className="text-sm text-muted-foreground">
          Against v{prev!.version}: {d.added.length} added, {d.changed.length} changed, {d.removed.length} removed.
        </p>
      )}
      {v.lines.length === 0 ? <p className="text-sm text-muted-foreground">No lines yet.</p> : (
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow><TableHead>Part</TableHead><TableHead>Name</TableHead><TableHead className="text-right">QPS</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((l) => {
                const part = p(l.child_part_id);
                const was = changed.get(l.child_part_id);
                return (
                  <TableRow key={l.child_part_id} className={cn(added.has(l.child_part_id) && "bg-emerald-50 dark:bg-emerald-950/30", was && "bg-amber-50 dark:bg-amber-950/30")}>
                    <TableCell className="font-mono text-xs">{part?.part_code ?? "?"}</TableCell>
                    <TableCell className="text-sm">{part?.name}{l.is_critical && <Badge variant="outline" className="ml-2">critical</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {was && <span className="text-muted-foreground line-through mr-2">{qtyText(was, part?.uom)}</span>}
                      {qtyText(l, part?.uom)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{added.has(l.child_part_id) ? "added" : was ? "changed" : ""}</TableCell>
                  </TableRow>
                );
              })}
              {(d?.removed ?? []).map((l) => (
                <TableRow key={`x-${l.child_part_id}`} className="bg-red-50 dark:bg-red-950/30">
                  <TableCell className="font-mono text-xs line-through">{p(l.child_part_id)?.part_code}</TableCell>
                  <TableCell className="text-sm line-through">{p(l.child_part_id)?.name}</TableCell>
                  <TableCell className="text-right tabular-nums line-through">{qtyText(l, p(l.child_part_id)?.uom)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">removed</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL = { SAME: "same as model", QTY: "quantity differs", MISSING: "missing from brand", BRAND_ONLY: "brand only" } as const;

function Brands({ brands, versions, bom, parts, canApprove, m }: {
  brands: BrandRow[]; versions: ModelVersion[]; bom: any[]; parts: Map<string, PartLite>; canApprove: boolean;
  m: ReturnType<typeof useModelMutations>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<BrandRow | null>(null);
  const rel = latestReleased(versions);
  if (brands.length === 0) return <p className="text-sm text-muted-foreground">No brand codes on this model yet.</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Brand code</TableHead><TableHead>Built on</TableHead>
            <TableHead>Against its version</TableHead><TableHead className="text-right">Brand-only lines</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((b) => {
            const v = versions.find((x) => x.version === b.model_version);
            const c = compareBrand(parts, bom, b.id, v);
            const behind = rel && versionCmp(b.model_version, rel.version) < 0;
            const isOpen = open === b.id;
            return (
              <Fragment key={b.id}>
                <TableRow className={cn("cursor-pointer", !b.is_active && "opacity-60")} onClick={() => setOpen(isOpen ? null : b.id)}>
                  <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell><div className="font-mono font-medium">{b.part_code}</div><div className="text-sm">{b.name}</div></TableCell>
                  <TableCell className="whitespace-nowrap">
                    v{b.model_version ?? "?"}{v?.status === "DRAFT" && <span className="text-xs text-muted-foreground"> (draft)</span>}
                    {behind && <Badge variant="warning" className="ml-2">v{rel!.version} out</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {!v || v.lines.length === 0 ? <span className="text-muted-foreground">version has no lines yet</span> : (
                      <span>
                        {c.same} same
                        {c.qty > 0 && <span className="text-amber-700 dark:text-amber-400"> · {c.qty} quantity differs</span>}
                        {c.missing > 0 && <span className="text-destructive"> · {c.missing} missing</span>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.brandOnly}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right whitespace-nowrap">
                    {canApprove && behind && <Button size="sm" variant="outline" onClick={() => setMoving(b)}>Move to v{rel!.version}</Button>}
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow>
                    <TableCell />
                    <TableCell colSpan={5}>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Brand only = this brand's cosmetics (box, stickers, logo, manual). Quantity differs or missing on a hardware line
                        means the brand is not built exactly on v{b.model_version}: fix the brand's BOM, or the model.
                      </p>
                      <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow><TableHead>Part</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Model</TableHead><TableHead className="text-right">Brand</TableHead><TableHead /></TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.rows.map((r) => {
                              const part = parts.get(r.brandChild ?? r.key);
                              return (
                                <TableRow key={r.key} className={cn(r.status === "QTY" && "bg-amber-50 dark:bg-amber-950/30", r.status === "MISSING" && "bg-red-50 dark:bg-red-950/30")}>
                                  <TableCell className="font-mono text-xs">{part?.part_code}</TableCell>
                                  <TableCell className="text-sm">{part?.name}</TableCell>
                                  <TableCell className="text-right tabular-nums whitespace-nowrap">{qtyText(r.model, part?.uom)}</TableCell>
                                  <TableCell className="text-right tabular-nums whitespace-nowrap">{r.brandChild ? qtyText({ quantity: r.brandQty ?? null, bulk: r.brandBulk }, part?.uom) : "—"}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{STATUS_LABEL[r.status]}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      {moving && rel && <MoveDialog brand={moving} to={rel} bom={bom} parts={parts} m={m} onClose={() => setMoving(null)} />}
    </>
  );
}

function MoveDialog({ brand, to, bom, parts, m, onClose }: {
  brand: BrandRow; to: ModelVersion; bom: any[]; parts: Map<string, PartLite>; m: ReturnType<typeof useModelMutations>; onClose: () => void;
}) {
  const [preview, setPreview] = useState<ModelLine[] | null>(null);
  useEffect(() => {
    brandMovePreview(brand.id, to.id).then((l) => setPreview(l as ModelLine[])).catch((e) => toast.error(e.message));
  }, [brand.id, to.id]);
  const now: ModelLine[] = useMemo(() => bom.filter((l) => l.parent_part_id === brand.id).map((l) => ({
    child_part_id: l.child_part_id, quantity: l.quantity, bulk: l.issue_mode === "BULK", is_critical: l.is_critical })), [bom, brand.id]);
  const d = preview ? diffVersions(now, preview) : null;
  const name = (id: string) => `${parts.get(id)?.part_code ?? "?"} ${parts.get(id)?.name ?? ""}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Move {brand.part_code} from v{brand.model_version} to v{to.version}?</DialogTitle></DialogHeader>
        {!d ? <p className="text-sm text-muted-foreground">Working out the change…</p> : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {to.ecn_no ?? `v${to.version}`}: {to.reason}. The brand's cosmetics stay as they are; only the model's lines change.
            </p>
            {[["Added", d.added.map((l) => `${name(l.child_part_id)} — ${qtyText(l, parts.get(l.child_part_id)?.uom)}`)],
              ["Changed", d.changed.map((c) => `${name(c.to.child_part_id)} — ${qtyText(c.from)} → ${qtyText(c.to)}`)],
              ["Removed", d.removed.map((l) => name(l.child_part_id))]].map(([label, list]) => (list as string[]).length > 0 && (
              <div key={label as string}>
                <div className="font-medium">{label as string} ({(list as string[]).length})</div>
                <ul className="mt-1 max-h-32 overflow-y-auto list-disc pl-5 text-muted-foreground">{(list as string[]).map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
            {d.added.length + d.changed.length + d.removed.length === 0 && <p>The BOM does not change; only the version it is recorded on.</p>}
            <p className="text-muted-foreground">Vouchers made from now on record v{to.version}.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!d || m.moveBrand.isPending} onClick={async () => { await m.moveBrand.mutateAsync({ brand: brand.id, version: to.id }); onClose(); }}>
            Move to v{to.version}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EcnDialog({ kind, onClose, rel, versions, onSubmit }: {
  kind: null | "ECN" | "MAJOR"; onClose: () => void; rel?: ModelVersion; versions: ModelVersion[]; onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (kind) setReason(""); }, [kind]);
  if (!rel) return null;
  const maxMajor = Math.max(...versions.map((v) => v.major));
  const nextMinor = Math.max(...versions.filter((v) => v.major === rel.major).map((v) => v.minor)) + 1;
  const next = kind === "MAJOR" ? `${maxMajor + 1}.0` : `${rel.major}.${nextMinor}`;
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{kind === "MAJOR" ? "Major redesign" : "Engineering change"}: v{rel.version} → v{next}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A draft v{next} opens as a copy of v{rel.version}. Change its BOM, then Management releases it. Brands stay on
            v{rel.version} until each is moved.
          </p>
          <div className="space-y-1">
            <Label htmlFor="ecn-reason">What changes and why</Label>
            <Textarea id="ecn-reason" rows={3} placeholder="e.g. Woofer 2515-TT replaced by 393-TT for lower distortion" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>Open v{next} draft</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddBrandDialog({ open, onOpenChange, modelCode, modelName, taken, version, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; modelCode: string; modelName: string; taken: string[];
  version?: string; onSubmit: (brand: string, name: string) => Promise<void>;
}) {
  const { brands } = useBrands();
  const [brand, setBrand] = useState("");
  const [nm, setNm] = useState("");
  useEffect(() => { if (open) { setBrand(""); setNm(""); } }, [open]);
  const free = brands.filter((b) => !taken.includes(b.letter));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add a brand to {modelCode}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ab-brand">Brand</Label>
            <select id="ab-brand" className={cn(sel, "w-full h-10")} value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Choose…</option>
              {free.map((b) => <option key={b.letter} value={b.letter}>{b.name} ({b.letter})</option>)}
            </select>
            <p className="text-xs text-muted-foreground">A new brand is registered on the Parts page's create form.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-name">Sales name</Label>
            <Input id="ab-name" placeholder={`e.g. ${modelName}`} value={nm} onChange={(e) => setNm(e.target.value)} />
          </div>
          {brand && (
            <p className="text-sm">
              Creates <span className="font-mono font-medium">{modelCode}-{brand}</span>{version ? <> on v{version}, its BOM started from the model's lines</> : ""}.
              Then add its box, stickers, logo and manual to its BOM on the Parts page.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!brand} onClick={() => onSubmit(brand, nm)}>Create {brand ? `${modelCode}-${brand}` : ""}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ModelDetail;
