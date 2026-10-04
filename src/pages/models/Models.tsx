import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { usePermissions } from "@/hooks/usePermissions";
import { usePartCategories } from "@/hooks/usePartCategories";
import { byVersion, latestReleased, useModelMutations, useModels, useNextModelCode, versionCmp } from "@/hooks/useModels";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/**
 * Every model (JA-006): its versions and the brand codes built on it. A model is
 * the product; a brand is packaging, stickers and logo on one of its versions.
 */
const Models = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useModels();
  const { categories } = usePartCategories();
  const { canEditMasters, canApprove } = usePermissions();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const finished = categories.filter((c) => c.tier === "FINISHED");

  const rows = useMemo(() => (data?.models ?? []).filter((m) =>
    (!cat || m.category === cat) &&
    (!q || `${m.part_code} ${m.name} ${(data?.brands ?? []).filter((b) => b.model_id === m.id).map((b) => `${b.part_code} ${b.name}`).join(" ")}`
      .toLowerCase().includes(q.toLowerCase()))), [data, q, cat]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Models"
        actions={(canEditMasters || canApprove) && <Button onClick={() => setOpen(true)}><Plus /> New model</Button>}
      />
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            A model is the product: category and number (JA-006), with its master BOM per version. A hardware change is an ECN
            and makes the next version (1.0 → 1.1); a redesign makes 2.0. Each brand code (JA-006-PH) is built on one version and
            adds only its cosmetics: box, stickers, logo, manual.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search model or brand code" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select aria-label="Category" className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {finished.map((c) => <option key={c.prefix} value={c.prefix}>{c.name} ({c.prefix})</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>In draft</TableHead>
                  <TableHead>Brands (version built on)</TableHead>
                  <TableHead>R&amp;D</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableSkeleton columns={5} rows={4} /> : rows.length === 0 ? (
                  <TableEmpty columns={5} message="No models here" />
                ) : rows.map((m) => {
                  const versions = (data!.versions.filter((v) => v.model_id === m.id)).sort(byVersion);
                  const rel = latestReleased(versions);
                  const draft = versions.find((v) => v.status === "DRAFT");
                  const brands = data!.brands.filter((b) => b.model_id === m.id);
                  return (
                    <TableRow key={m.id} className={cn("cursor-pointer", !m.is_active && "opacity-60")}
                              onClick={() => navigate(`/models/${encodeURIComponent(m.part_code)}`)}>
                      <TableCell>
                        <div className="font-mono font-medium">{m.part_code}</div>
                        <div className="text-sm">{m.name}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{rel ? `v${rel.version}` : <span className="text-muted-foreground">not yet</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {draft ? <Badge variant="secondary">{draft.ecn_no ? `${draft.ecn_no} · ` : ""}v{draft.version}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {brands.length === 0 && <span className="text-muted-foreground text-sm">none yet</span>}
                          {brands.map((b) => (
                            <Badge key={b.id} variant={rel && versionCmp(b.model_version, rel.version) < 0 ? "warning" : "outline"}
                                   title={rel && versionCmp(b.model_version, rel.version) < 0 ? `Behind v${rel.version}` : undefined}>
                              {b.part_code} · v{b.model_version ?? "?"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {m.plm ? <Link className="font-mono text-sm underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(m.plm.product_code)}`}>{m.plm.product_code}</Link> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <NewModelDialog open={open} onOpenChange={setOpen} onCreated={(code) => navigate(`/models/${encodeURIComponent(code)}`)} />
    </DashboardLayout>
  );
};

/** New model: the number is given per category; type over it for a derived model like 06C. */
export function NewModelDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (code: string) => void;
}) {
  const { categories } = usePartCategories();
  const { data } = useModels();
  const { createModel } = useModelMutations();
  const finished = categories.filter((c) => c.tier === "FINISHED");
  const [cat, setCat] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const { data: next } = useNextModelCode(cat || undefined);
  useEffect(() => { if (open) { setCat(""); setCode(""); setName(""); setCopyFrom(""); } }, [open]);
  useEffect(() => { if (next) setCode(next); }, [next]);
  const sources = (data?.versions ?? []).filter((v) => v.lines.length > 0)
    .map((v) => ({ v, m: data!.models.find((m) => m.id === v.model_id) }))
    .filter((x) => x.m).sort((a, b) => a.m!.part_code.localeCompare(b.m!.part_code) || byVersion(a.v, b.v));

  const submit = async () => {
    if (!cat || !code.trim()) return;
    await createModel.mutateAsync({ category: cat, code: code.trim().toUpperCase(), name: name.trim(), copyFrom: copyFrom || null });
    onOpenChange(false);
    onCreated?.(code.trim().toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New model</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nm-cat">Category</Label>
            <select id="nm-cat" className={cn(sel, "w-full h-10")} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Choose…</option>
              {finished.map((c) => <option key={c.prefix} value={c.prefix}>{c.name} ({c.prefix})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nm-code">Model number</Label>
            <Input id="nm-code" value={code} disabled={!cat} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <p className="text-xs text-muted-foreground">
              The next free number of the category. Type over it only for a model derived from another, like JA-06C.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nm-name">Name</Label>
            <Input id="nm-name" placeholder="e.g. 80W party speaker" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nm-copy">Start v1.0's BOM from</Label>
            <select id="nm-copy" className={cn(sel, "w-full h-10")} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Nothing - an empty BOM</option>
              {sources.map(({ v, m }) => <option key={v.id} value={v.id}>{m!.part_code} v{v.version}{v.status === "DRAFT" ? " (draft)" : ""}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!cat || !code.trim() || createModel.isPending}>Create {code || "model"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Models;
