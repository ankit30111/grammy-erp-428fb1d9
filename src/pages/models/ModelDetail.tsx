import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import { VersionTree } from "@/components/Engineering/VersionTree";
import { usePermissions } from "@/hooks/usePermissions";
import { useBrands } from "@/hooks/usePartCategories";
import { type BrandRow, type ModelVersionRow, latestReleased, useModel, useModelMutations, versionCmp } from "@/hooks/useModels";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

const ModelDetail = () => {
  const { code } = useParams();
  const { data, isLoading } = useModel(code);
  const { canEditMasters, canApprove } = usePermissions();
  const canEdit = canEditMasters || canApprove;
  const m = useModelMutations();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (isLoading) return <DashboardLayout><p className="text-muted-foreground">Loading…</p></DashboardLayout>;
  if (!data) return <DashboardLayout><p>No model {code}. <Link className="underline" to="/models">All models</Link></p></DashboardLayout>;
  const { model } = data;

  return (
    <DashboardLayout>
      <PageHeader
        title={`${model.part_code} — ${model.name}`}
        breadcrumb={[{ label: "Models", to: "/models" }, { label: model.part_code }]}
        actions={canEdit && (
          <Button variant="outline" size="sm" onClick={() => { setName(model.name); setRenaming(true); }}><Pencil /> Rename</Button>
        )}
      />
      <ModelWorkspace code={model.part_code} />
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

/**
 * A model's version history (each version's BOM as a tree, read only) and its
 * brand codes. The same block is on the Models page and on the model's R&D
 * product. The BOM itself is edited on the R&D product's BOM tab.
 */
export function ModelWorkspace({ code, fromRnd }: { code: string; fromRnd?: boolean }) {
  const { data, isLoading } = useModel(code);
  const { canEditMasters, canApprove } = usePermissions();
  const canEdit = canEditMasters || canApprove;
  const m = useModelMutations();
  const [addBrand, setAddBrand] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No model {code}.</p>;
  const { model, versions, brands } = data;
  const rel = latestReleased(versions);
  const draft = versions.find((v) => v.status === "DRAFT");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>{rel ? <>Released <span className="font-medium text-foreground">v{rel.version}</span></> : "No version released yet"}</span>
        {draft && <span>· In draft: <span className="font-medium text-foreground">v{draft.version}</span>{draft.ecn ? ` (${draft.ecn.ecn_no})` : ""}</span>}
        {fromRnd
          ? <span>· Model <Link className="font-mono underline-offset-2 hover:underline" to={`/models/${encodeURIComponent(model.part_code)}`}>{model.part_code}</Link></span>
          : model.plm && (
            <span>· BOM and ECNs are run by R&amp;D: <Link className="font-mono underline-offset-2 hover:underline"
              to={`/rnd/products/${encodeURIComponent(model.plm.product_code)}?tab=bom`}>{model.plm.product_code} → BOM</Link></span>
          )}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Versions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Version</TableHead><TableHead>Change</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Lines</TableHead><TableHead>Brand codes on it</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.length === 0 && <TableEmpty columns={6} message="No version yet" />}
              {versions.map((v) => {
                const on = brands.filter((b) => b.model_version === v.version);
                const isOpen = open === v.id;
                return (
                  <Fragment key={v.id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : v.id)}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-mono font-medium">v{v.version}</TableCell>
                      <TableCell className="min-w-[220px]">
                        {v.ecn && <span className="font-mono text-xs mr-2">{v.ecn.ecn_no}</span>}
                        {v.kind === "MAJOR" && <Badge variant="secondary" className="mr-2">redesign</Badge>}
                        <span className="text-sm">{v.ecn?.title ?? v.note ?? "—"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {v.status === "RELEASED" ? <span className="text-sm">Released {fmtDate(v.released_at)}</span> : <Badge variant="warning">draft</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{v.lines}</TableCell>
                      <TableCell className="font-mono text-xs">{on.map((b) => b.part_code).join(", ") || "—"}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={5}><VersionTree rootId={v.id} canEdit={false} dense /></TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Brand codes</CardTitle>
            {canEdit && <Button size="sm" onClick={() => setAddBrand(true)}><Plus /> Add brand</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            A brand code's production BOM is the version's lines that are for every brand plus those marked for its brand.
            Moving it to a newer version rebuilds its BOM from that version.
          </p>
          <Brands brands={brands} versions={versions} canApprove={canApprove} m={m} />
        </CardContent>
      </Card>

      <AddBrandDialog open={addBrand} onOpenChange={setAddBrand} modelCode={model.part_code} modelName={model.name}
        taken={brands.map((b) => b.brand)} version={rel?.version ?? versions[versions.length - 1]?.version}
        onSubmit={async (brand, nm) => { await m.addBrand.mutateAsync({ model: model.id, brand, name: nm }); setAddBrand(false); }} />
    </div>
  );
}

function Brands({ brands, versions, canApprove, m }: {
  brands: BrandRow[]; versions: ModelVersionRow[]; canApprove: boolean; m: ReturnType<typeof useModelMutations>;
}) {
  const rel = latestReleased(versions);
  if (brands.length === 0) return <p className="text-sm text-muted-foreground">No brand codes on this model yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Brand code</TableHead><TableHead>Built on</TableHead><TableHead /></TableRow>
      </TableHeader>
      <TableBody>
        {brands.map((b) => {
          const behind = rel && versionCmp(b.model_version, rel.version) < 0;
          return (
            <TableRow key={b.id} className={cn(!b.is_active && "opacity-60")}>
              <TableCell><div className="font-mono font-medium">{b.part_code}</div><div className="text-sm">{b.name}</div></TableCell>
              <TableCell className="whitespace-nowrap">
                v{b.model_version ?? "?"}
                {behind && <Badge variant="warning" className="ml-2">v{rel!.version} out</Badge>}
              </TableCell>
              <TableCell className="text-right">
                {canApprove && behind && (
                  <Button size="sm" variant="outline" disabled={m.moveBrand.isPending}
                          onClick={() => window.confirm(`Rebuild ${b.part_code}'s BOM from v${rel!.version}?`) && m.moveBrand.mutate({ brand: b.id, version: rel!.id })}>
                    Move to v{rel!.version}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-name">Sales name</Label>
            <Input id="ab-name" placeholder={`e.g. ${modelName}`} value={nm} onChange={(e) => setNm(e.target.value)} />
          </div>
          {brand && (
            <p className="text-sm">
              Creates <span className="font-mono font-medium">{modelCode}-{brand}</span>{version ? <> on v{version}: its BOM is that version's lines for every brand</> : ""}.
              Lines only {brand} needs (its box, logo, manual) are added in R&amp;D's BOM and marked for {brand}.
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
