import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { usePartCodeExport } from "@/hooks/usePartCodeExport";
import type { PartTier } from "@/hooks/usePartCategories";
import { cn } from "@/lib/utils";
import { ddmmyyyy, downloadBytes, readSpreadsheetFile } from "@/lib/xlsxLite";
import {
  type ImportKind, type PlanRow, customersWorkbook, partsWorkbook, planCustomers, planParts, vendorsWorkbook,
} from "@/lib/dataIO";

const ACTION: Record<PlanRow["action"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  NEW: { label: "New", variant: "default" },
  UPDATE: { label: "Change", variant: "outline" },
  SAME: { label: "No change", variant: "secondary" },
  ERROR: { label: "Problem", variant: "destructive" },
};

const KINDS: { id: ImportKind; label: string; sheet: string }[] = [
  { id: "parts", label: "Parts", sheet: "Parts" },
  { id: "customers", label: "Customers", sheet: "Customers" },
];

function ExportRow({ title, blurb, actions }: { title: string; blurb: string; actions: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-[220px] flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{blurb}</div>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export default function DataImportExport() {
  const { canEditMasters, canEditCustomers } = usePermissions();
  const { exportTier, busy: tierBusy } = usePartCodeExport();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const [kind, setKind] = useState<ImportKind>("parts");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [show, setShow] = useState<"all" | PlanRow["action"]>("all");

  const canImport = kind === "parts" ? canEditMasters : canEditCustomers;

  const download = async (id: string, make: () => Promise<Uint8Array>, name: string) => {
    setBusy(id);
    try { downloadBytes(await make(), `${name} ${ddmmyyyy()}.xlsx`); }
    catch (e: any) { toast.error(e.message ?? "Export failed"); }
    finally { setBusy(null); }
  };

  const pickFile = async (file: File) => {
    setReading(true); setPlan(null); setFileName(file.name); setShow("all");
    try {
      const rows = await readSpreadsheetFile(file, KINDS.find((k) => k.id === kind)!.sheet);
      const p = kind === "parts" ? await planParts(rows) : await planCustomers(rows);
      if (!p.length) toast.warning("The file has no rows under the header");
      // Problems first, then what will be saved, then the rows that stay as they are.
      const order = { ERROR: 0, NEW: 1, UPDATE: 2, SAME: 3 } as const;
      p.sort((a, b) => order[a.action] - order[b.action] || a.row - b.row);
      setPlan(p);
    } catch (e: any) {
      toast.error(e.message ?? "Could not read the file");
      setFileName("");
    } finally {
      setReading(false);
    }
  };

  const toApply = (plan ?? []).filter((r) => (r.action === "NEW" || r.action === "UPDATE") && r.status !== "done");
  const counts = (plan ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.action]: (a[r.action] ?? 0) + 1 }), {});

  const runImport = async () => {
    if (!plan) return;
    const rows = toApply;
    setRunning({ done: 0, total: rows.length });
    let ok = 0, failed = 0;
    for (const r of rows) {
      try {
        const res = await r.apply!();
        r.status = "done"; r.result = typeof res === "string" ? res : "Saved"; ok++;
      } catch (e: any) {
        r.status = "failed"; r.result = e?.message ?? "Failed"; failed++;
      }
      setRunning((x) => x && { ...x, done: x.done + 1 });
      setPlan([...plan]);
    }
    setRunning(null);
    qc.invalidateQueries({ queryKey: kind === "parts" ? ["parts"] : ["customers"] });
    qc.invalidateQueries({ queryKey: ["master-approvals"] });
    if (failed) toast.warning(`${ok} saved, ${failed} not saved. See the Result column.`);
    else toast.success(`${ok} saved`);
  };

  const shown = (plan ?? []).filter((r) => show === "all" || r.action === show);
  const tierBtn = (tier: PartTier) => (
    <Button variant="outline" size="sm" disabled={!!tierBusy} onClick={() => exportTier(tier)}>
      <Download className="h-4 w-4" /> {tierBusy === tier ? "Preparing…" : "Code Master"}
    </Button>
  );

  return (
    <DashboardLayout>
      <PageHeader title="Import / Export" breadcrumb={[{ label: "Management" }, { label: "Import / Export" }]} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader className="pb-0"><CardTitle>Export</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <ExportRow title="Purchase Part" blurb="Part Code Master, in the offline file's format"
                       actions={<>{tierBtn("PURCHASE")}
                         <Button variant="outline" size="sm" disabled={busy === "parts"} onClick={() => download("parts", () => partsWorkbook(true), "Parts list")}>
                           <Download className="h-4 w-4" /> {busy === "parts" ? "Preparing…" : "Editable list"}
                         </Button></>} />
            <ExportRow title="Sub-assembly" blurb="Sub-assembly Code Master. Each Sub-assembly is also in the editable parts list."
                       actions={tierBtn("SUB_ASSEMBLED")} />
            <ExportRow title="Finished Good" blurb="Finished Good Code Master with model and brand" actions={tierBtn("FINISHED")} />
            <ExportRow title="Customers" blurb="Codes, brands, contacts and GST. Bank details stay in the ERP."
                       actions={<Button variant="outline" size="sm" disabled={busy === "customers"} onClick={() => download("customers", () => customersWorkbook(true), "Customers")}>
                         <Download className="h-4 w-4" /> {busy === "customers" ? "Preparing…" : "Editable list"}
                       </Button>} />
            <ExportRow title="Vendors" blurb="Codes, contacts, GST and what they supply. Bank details stay in the ERP."
                       actions={<Button variant="outline" size="sm" disabled={busy === "vendors"} onClick={() => download("vendors", vendorsWorkbook, "Vendors")}>
                         <Download className="h-4 w-4" /> {busy === "vendors" ? "Preparing…" : "List"}
                       </Button>} />
            <p className="pt-3 text-xs text-muted-foreground">
              An editable list can be changed in Excel and imported back. The CRS of a product is exported from its R&amp;D page (CRS tab).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle>Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border p-0.5 text-sm">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" disabled={!!running}
                          onClick={() => { setKind(k.id); setPlan(null); setFileName(""); }}
                          className={cn("rounded px-3 py-1", kind === k.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {k.label}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" disabled={busy === "tpl"}
                      onClick={() => download("tpl", () => (kind === "parts" ? partsWorkbook(false) : customersWorkbook(false)), `${kind === "parts" ? "Parts" : "Customers"} import template`)}>
                <Download className="h-4 w-4" /> Template
              </Button>
              {canImport ? (
                <label className={cn("ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90",
                  (reading || running) && "pointer-events-none opacity-50")}>
                  <Upload className="h-4 w-4" /> {reading ? "Checking…" : "Choose file"}
                  <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
                </label>
              ) : (
                <span className="ml-auto text-sm text-muted-foreground">
                  {kind === "parts" ? "Management and R&D can import parts." : "Management can import customers."}
                </span>
              )}
            </div>

            {!plan && (
              <p className="text-sm text-muted-foreground">
                Use the template or an exported editable list (.xlsx or .csv). Nothing is saved until you check the rows and press Import.
                Rows without a code are new; rows with a code change that {kind === "parts" ? "part" : "customer"}, and empty cells keep what is there.
              </p>
            )}

            {plan && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="mr-1 font-medium">{fileName}</span>
                  {(["all", "NEW", "UPDATE", "SAME", "ERROR"] as const).map((a) => {
                    const n = a === "all" ? plan.length : counts[a] ?? 0;
                    if (a !== "all" && !n) return null;
                    return (
                      <button key={a} type="button" onClick={() => setShow(a)}
                              className={cn("rounded-full border px-2.5 py-0.5", show === a ? "border-primary bg-primary/10" : "hover:bg-muted",
                                a === "ERROR" && "text-destructive")}>
                        {a === "all" ? "All" : ACTION[a].label} <span className="tabular-nums">{n}</span>
                      </button>
                    );
                  })}
                  <Button className="ml-auto" disabled={!toApply.length || !!running} onClick={runImport}>
                    {running ? `Importing ${running.done}/${running.total}…` : `Import ${toApply.length} row${toApply.length === 1 ? "" : "s"}`}
                  </Button>
                </div>
                {(counts.ERROR ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">Rows with a problem are skipped. Fix them in the file and choose it again, or import the rest now.</p>
                )}
                <div className="max-h-[60vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                        <TableHead className="w-28">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Details</TableHead>
                        {plan.some((r) => r.status) && <TableHead>Result</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((r) => (
                        <TableRow key={r.row}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.row}</TableCell>
                          <TableCell><Badge className="whitespace-nowrap" variant={ACTION[r.action].variant}>{ACTION[r.action].label}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-sm">{r.code || "—"}</TableCell>
                          <TableCell className="text-sm">{r.name}</TableCell>
                          <TableCell className={cn("text-sm", r.action === "ERROR" ? "text-destructive" : "text-muted-foreground")}>{r.note}</TableCell>
                          {plan.some((x) => x.status) && (
                            <TableCell className={cn("text-sm", r.status === "failed" && "text-destructive")}>{r.result ?? ""}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
