import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { STAGES, usePlmProducts } from "@/hooks/usePLM";
import { NewProductDialog } from "@/components/PLM/NewProductDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
export const priorityVariant = (p: string) => (p === "HIGH" ? "destructive" : p === "MEDIUM" ? "warning" : "secondary") as any;
export const stageLabel = (n: number) => `${n} · ${STAGES[n - 1]?.name ?? ""}`;

/**
 * R&D pipeline: every product by stage, like the Dashboard sheet of the PLM
 * tracker, plus every open issue across products.
 */
const PLMDashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = usePlmProducts();
  const { canEditMasters, canApprove } = usePermissions();
  const canEdit = canEditMasters || canApprove;
  const [tab, setTab] = useState("pipeline");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<number | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [open, setOpen] = useState(false);

  const products = data?.products ?? [];
  const byCode = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const openIssues = (data?.issues ?? []).filter((i) => i.status === "OPEN");
  const issuesBy = useMemo(() => {
    const m = new Map<string, number>();
    openIssues.forEach((i) => m.set(i.product_id, (m.get(i.product_id) ?? 0) + 1));
    return m;
  }, [openIssues]);

  const shown = products.filter((p) =>
    (status === "ALL" || p.status === status) &&
    (stage === null || p.stage === stage) &&
    (!q || `${p.product_code} ${p.name} ${p.client ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const active = products.filter((p) => p.status === "ACTIVE");

  return (
    <DashboardLayout>
      <PageHeader
        title="R&D"
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus /> New product</Button>}
      />
      <div className="space-y-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {STAGES.map((s) => {
            const n = active.filter((p) => p.stage === s.n).length;
            return (
              <button key={s.n} type="button" onClick={() => { setTab("pipeline"); setStage(stage === s.n ? null : s.n); }}
                className={cn("rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary",
                  stage === s.n && "border-primary ring-1 ring-primary")}>
                <div className="text-2xl font-semibold tabular-nums">{n}</div>
                <div className="text-xs text-muted-foreground">{stageLabel(s.n)}</div>
              </button>
            );
          })}
        </div>

        <TabBar
          tabs={[{ id: "pipeline", label: "Products", count: shown.length }, { id: "issues", label: "Open issues", count: openIssues.length },
                 { id: "catchup", label: "Built before release", count: data?.catchUp.length ?? 0 }]}
          value={tab} onChange={setTab}
        />

        {tab === "pipeline" && (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search product ID, name or client" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <select aria-label="Status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option>
                  <option value="DROPPED">Dropped</option><option value="ALL">All</option>
                </select>
                {stage !== null && <Button variant="outline" size="sm" className="h-9" onClick={() => setStage(null)}>All stages</Button>}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">This stage</TableHead>
                      <TableHead className="text-right">BOM</TableHead>
                      <TableHead className="text-right">Open issues</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Target launch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton columns={8} rows={5} /> : shown.length === 0 ? (
                      <TableEmpty columns={8} message="No products here" hint={canEdit ? "Add one with New product." : undefined} />
                    ) : shown.map((p) => {
                      const pr = data?.progress.get(p.id)?.[p.stage];
                      const base = p.based_on_id ? byCode.get(p.based_on_id) : null;
                      return (
                        <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/rnd/products/${encodeURIComponent(p.product_code)}`)}>
                          <TableCell>
                            <div className="font-mono font-medium">{p.product_code}</div>
                            <div className="text-sm">{p.name}</div>
                            {data?.catchUp.some((c) => c.product_id === p.id) && (
                              <Badge variant="warning" className="mt-1">in production · R&amp;D to complete</Badge>
                            )}
                            {p.kind === "VARIATION" && (
                              <div className="text-xs text-muted-foreground">Variation{base ? ` of ${base.product_code}` : ""}</div>
                            )}
                          </TableCell>
                          <TableCell>{p.client ?? <span className="text-muted-foreground">Grammy</span>}</TableCell>
                          <TableCell className="whitespace-nowrap">{stageLabel(p.stage)}</TableCell>
                          <TableCell className="text-right tabular-nums">{pr && pr.total ? `${Math.round((100 * pr.done) / pr.total)}%` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{data?.bomPct.has(p.id) ? `${data.bomPct.get(p.id)}%` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{issuesBy.get(p.id) ? <span className="text-destructive font-medium">{issuesBy.get(p.id)}</span> : "—"}</TableCell>
                          <TableCell><Badge variant={priorityVariant(p.priority)}>{p.priority.toLowerCase()}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap">{p.target_launch ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "catchup" && (
          <Card>
            <CardContent className="pt-5 space-y-3 overflow-x-auto">
              <p className="text-sm text-muted-foreground">
                These products are already being built while R&amp;D has not finished their stages. Production is not held up;
                R&amp;D should complete the checklists, tests and gates of each.
              </p>
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Stage</TableHead><TableHead>Codes</TableHead><TableHead>Vouchers</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.catchUp ?? []).length === 0 ? <TableEmpty columns={4} message="Nothing is being built ahead of R&D" /> : data!.catchUp.map((c) => (
                    <TableRow key={c.product_id} className="cursor-pointer" onClick={() => navigate(`/rnd/products/${encodeURIComponent(c.product_code)}`)}>
                      <TableCell className="font-mono font-medium">{c.product_code}</TableCell>
                      <TableCell className="whitespace-nowrap">{stageLabel(c.stage)}</TableCell>
                      <TableCell className="font-mono">{c.part_codes}</TableCell>
                      <TableCell className="font-mono">{c.vouchers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "issues" && (
          <Card>
            <CardContent className="pt-5 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead><TableHead>Product</TableHead><TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead><TableHead>Owner</TableHead><TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openIssues.length === 0 ? <TableEmpty columns={6} message="No open issues" /> : openIssues.map((i) => {
                    const p = byCode.get(i.product_id);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono whitespace-nowrap">{i.issue_no}</TableCell>
                        <TableCell className="font-mono">
                          {p && <Link className="underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(p.product_code)}?tab=issues`}>{p.product_code}</Link>}
                        </TableCell>
                        <TableCell className="min-w-[260px]">{i.description}</TableCell>
                        <TableCell><Badge variant={priorityVariant(i.severity)}>{i.severity.toLowerCase()}</Badge></TableCell>
                        <TableCell>{i.owner ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{i.target_date ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <NewProductDialog open={open} onOpenChange={setOpen} products={products}
        onCreated={(code, variation) => navigate(`/rnd/products/${encodeURIComponent(code)}${variation ? "?tab=bom" : ""}`)} />
    </DashboardLayout>
  );
};

export default PLMDashboard;
