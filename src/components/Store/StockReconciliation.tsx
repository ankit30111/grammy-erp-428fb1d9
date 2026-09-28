import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Download, Scale, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { getStockLocationId } from "@/utils/stockLedger";
import { cn } from "@/lib/utils";

/**
 * Stock count and opening stock.
 *
 * Every part the store can hold is listed - not only parts that already have
 * stock, which is why an empty store showed nothing to count. The store types
 * what is on the shelf (or fills the downloadable sheet in Excel and uploads it);
 * the database works out the adjustment against the ledger at the moment of
 * posting, so a GRN or kit issue in between is never double counted.
 */

const REASONS: { code: string; label: string }[] = [
  { code: "OPENING_STOCK", label: "Opening stock" },
  { code: "COUNTING_ERROR", label: "Counting error" },
  { code: "DAMAGED_MATERIAL", label: "Damaged material" },
  { code: "SHRINKAGE", label: "Shrinkage" },
  { code: "PRODUCTION_WASTE", label: "Production waste" },
  { code: "SUPPLIER_SHORTAGE", label: "Supplier shortage" },
  { code: "SYSTEM_ERROR", label: "System error" },
  { code: "THEFT_LOSS", label: "Theft / loss" },
  { code: "OTHER", label: "Other" },
];
const PAGE = 50;

type PartRow = {
  id: string; part_code: string; name: string; category: string | null; uom: string | null;
  purchase_uom: string | null; purchase_factor: number | null; source_type: string;
};
type Entry = { value: string; unit: "stock" | "buy"; reason: string; remarks: string };

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-IN") : Number(v.toFixed(4)).toLocaleString("en-IN"));
const hasBuyUnit = (p: PartRow) => !!p.purchase_uom && Number(p.purchase_factor || 1) !== 1;

// --- CSV (opens in Excel; no extra library) ------------------------------
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
};

const StockReconciliation = () => {
  const plantId = usePlantId();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // What has been typed so far. Kept in this browser so a refresh or a break
  // does not lose half a day of counting.
  const draftKey = `stock-count-draft:${plantId}`;
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  useEffect(() => {
    if (!plantId) return;
    try { setEntries(JSON.parse(localStorage.getItem(draftKey) || "{}")); } catch { setEntries({}); }
  }, [plantId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!plantId) return;
    try { localStorage.setItem(draftKey, JSON.stringify(entries)); } catch { /* storage full or blocked */ }
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["stock-count-parts"],
    queryFn: async (): Promise<PartRow[]> => {
      const { data, error } = await (supabase as any)
        .from("parts")
        .select("id, part_code, name, category, uom, purchase_uom, purchase_factor, source_type")
        .eq("is_active", true)
        .neq("source_type", "FINISHED_GOOD")
        .order("part_code")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["part-categories-names"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("part_categories").select("prefix, name").order("prefix");
      if (error) throw error;
      return (data ?? []) as { prefix: string; name: string }[];
    },
  });
  const { data: balances = new Map<string, number>(), refetch: refetchBalances } = useQuery({
    queryKey: ["stock-count-balances", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const main = await getStockLocationId(plantId!, "MAIN");
      const { data, error } = await (supabase as any)
        .from("stock_balance").select("part_id, quantity").eq("plant_id", plantId).eq("location_id", main).limit(5000);
      if (error) throw error;
      return new Map<string, number>((data ?? []).map((r: any) => [r.part_id, Number(r.quantity) || 0]));
    },
  });
  const catName = useMemo(() => new Map(categories.map((c) => [c.prefix, c.name])), [categories]);
  const byCode = useMemo(() => new Map(parts.map((p) => [p.part_code.toUpperCase(), p])), [parts]);

  const system = (id: string) => balances.get(id) ?? 0;
  const counted = (p: PartRow): number | null => {
    const e = entries[p.id];
    if (!e || e.value.trim() === "") return null;
    const n = Number(e.value);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return e.unit === "buy" && hasBuyUnit(p) ? n * Number(p.purchase_factor) : n;
  };
  const defaultReason = (p: PartRow) => (system(p.id) === 0 ? "OPENING_STOCK" : "");
  const set = (p: PartRow, patch: Partial<Entry>) =>
    setEntries((all) => {
      const cur = all[p.id] ?? { value: "", unit: "stock", reason: defaultReason(p), remarks: "" };
      return { ...all, [p.id]: { ...cur, ...patch } };
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (q && !p.part_code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
      const sys = system(p.id);
      if (view === "zero" && sys !== 0) return false;
      if (view === "stock" && sys === 0) return false;
      if (view === "entered" && counted(p) === null) return false;
      return true;
    });
  }, [parts, search, category, view, balances, entries]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(0), [search, category, view]);
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  // Everything typed, across all pages and filters.
  const lines = parts
    .map((p) => ({ p, c: counted(p), e: entries[p.id] }))
    .filter((x) => x.c !== null);
  const invalid = lines.filter((x) => Number.isNaN(x.c));
  const changes = lines.filter((x) => !Number.isNaN(x.c) && (x.c as number) !== system(x.p.id));
  const missingReason = changes.filter((x) => !x.e?.reason);
  const openingCount = changes.filter((x) => x.e?.reason === "OPENING_STOCK").length;

  const post = useMutation({
    mutationFn: async () => {
      const payload = changes.map(({ p, c, e }) => ({
        part_id: p.id, counted: c, reason: e?.reason || "OTHER", remarks: e?.remarks || "",
      }));
      // In batches, so a whole store's opening stock goes up without one huge call.
      let posted = 0; let reference = "";
      for (let i = 0; i < payload.length; i += 300) {
        const { data, error } = await (supabase as any).rpc("post_stock_count", {
          p_plant_id: plantId, p_lines: payload.slice(i, i + 300), p_reference: reference || null,
        });
        if (error) throw new Error(`${error.message}${posted ? ` (${posted} lines were already posted)` : ""}`);
        posted += data.posted; reference = data.reference;
      }
      return { posted, reference };
    },
    onSuccess: ({ posted, reference }) => {
      // Posted lines leave the draft; anything else typed stays.
      const done = new Set(changes.map((x) => x.p.id));
      for (const x of lines) if (!Number.isNaN(x.c) && x.c === system(x.p.id)) done.add(x.p.id);
      setEntries((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !done.has(id))));
      for (const k of ["stock-count-balances", "inventory", "inventory-reconciliation", "subassembly-positions", "voucher-materials"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      refetchBalances();
      toast.success(`${posted} stock line${posted === 1 ? "" : "s"} posted · ${reference}`);
      setConfirmOpen(false);
    },
    onError: (e: any) => { toast.error(e?.message ?? "Could not post the count"); setConfirmOpen(false); },
  });

  const downloadSheet = () => {
    const head = ["Part Code", "Part Name", "Category", "Stock Unit", "System Qty", "Physical Count", "Count Unit", "Reason", "Remarks", "Buy Unit (1 = n stock units)"];
    const body = filtered.map((p) => {
      const e = entries[p.id];
      return [p.part_code, p.name, catName.get(p.category ?? "") ?? p.category, p.uom ?? "PCS", system(p.id),
              e?.value ?? "", e?.unit === "buy" ? p.purchase_uom : (p.uom ?? "PCS"),
              REASONS.find((r) => r.code === (e?.reason || defaultReason(p)))?.label ?? "", e?.remarks ?? "",
              hasBuyUnit(p) ? `${p.purchase_uom} = ${p.purchase_factor} ${p.uom}` : ""];
    });
    const csv = [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-count-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const uploadSheet = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return toast.error("The sheet is empty");
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const col = (...names: string[]) => h.findIndex((x) => names.includes(x));
    const iCode = col("part code", "code", "part_code"), iCount = col("physical count", "count", "qty", "quantity", "physical qty");
    const iUnit = col("count unit", "unit"), iReason = col("reason"), iRemarks = col("remarks", "remark");
    if (iCode < 0 || iCount < 0) return toast.error('The sheet needs "Part Code" and "Physical Count" columns');

    const unknown: string[] = []; const bad: string[] = []; let filled = 0;
    const next = { ...entries };
    for (const r of rows.slice(1)) {
      const code = (r[iCode] ?? "").trim().toUpperCase();
      const raw = (r[iCount] ?? "").trim().replace(/,/g, "");
      if (!code || raw === "") continue;
      const p = byCode.get(code);
      if (!p) { unknown.push(code); continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) { bad.push(code); continue; }
      const unitTxt = iUnit >= 0 ? (r[iUnit] ?? "").trim().toUpperCase() : "";
      const unit: Entry["unit"] = hasBuyUnit(p) && unitTxt && unitTxt === (p.purchase_uom ?? "").toUpperCase() ? "buy" : "stock";
      const reasonTxt = iReason >= 0 ? (r[iReason] ?? "").trim().toLowerCase() : "";
      const reason = REASONS.find((x) => x.label.toLowerCase() === reasonTxt || x.code.toLowerCase() === reasonTxt)?.code
        ?? next[p.id]?.reason ?? defaultReason(p);
      next[p.id] = { value: String(n), unit, reason, remarks: iRemarks >= 0 ? (r[iRemarks] ?? "").trim() : next[p.id]?.remarks ?? "" };
      filled++;
    }
    setEntries(next);
    setView("entered");
    const msgs = [`${filled} count${filled === 1 ? "" : "s"} filled in from the sheet. Check them, then post.`];
    if (unknown.length) msgs.push(`Not found: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? ` +${unknown.length - 8} more` : ""}`);
    if (bad.length) msgs.push(`Not a number: ${bad.slice(0, 8).join(", ")}${bad.length > 8 ? ` +${bad.length - 8} more` : ""}`);
    (unknown.length || bad.length ? toast.warning : toast.success)(msgs.join(" · "), { duration: 10000 });
  };

  const canPost = changes.length > 0 && missingReason.length === 0 && invalid.length === 0 && !post.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" /> Stock Count &amp; Opening Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Type what is physically on the shelf, in the part's stock unit (or its buy unit where one is set). The
          difference from the system is booked when you post. For a big count, download the sheet, fill the
          Physical Count column in Excel, save it as CSV and upload it.
        </p>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search part code or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="lg:w-56"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.prefix} value={c.prefix}>{c.name} ({c.prefix})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="lg:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parts</SelectItem>
              <SelectItem value="zero">No stock yet</SelectItem>
              <SelectItem value="stock">Has stock</SelectItem>
              <SelectItem value="entered">Counted, not posted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadSheet} disabled={!filtered.length}>
            <Download /> Download sheet ({filtered.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Upload counts (CSV)
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSheet(f); e.target.value = ""; }} />
          {lines.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Clear everything typed but not posted?")) setEntries({}); }}>
              Clear draft
            </Button>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length.toLocaleString("en-IN")} of {parts.length.toLocaleString("en-IN")} parts
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader className="[&_th]:whitespace-nowrap">
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead className="text-right hidden sm:table-cell">System</TableHead>
                <TableHead>Physical count</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead className="hidden xl:table-cell">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading parts…</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No parts match</TableCell></TableRow>
              ) : pageRows.map((p) => {
                const e = entries[p.id];
                const sys = system(p.id);
                const c = counted(p);
                const diff = c === null || Number.isNaN(c) ? null : c - sys;
                return (
                  <TableRow key={p.id} className={cn(diff !== null && diff !== 0 && "bg-warning-wash")}>
                    <TableCell className="min-w-[12rem]">
                      <div className="font-mono font-medium">{p.part_code}</div>
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{catName.get(p.category ?? "") ?? p.category} · {p.uom ?? "PCS"}</div>
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell whitespace-nowrap">{fmt(sys)} <span className="text-xs text-muted-foreground">{p.uom}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Input type="number" min={0} step="any" inputMode="decimal" className={cn("w-28", Number.isNaN(c) && "border-destructive")}
                               value={e?.value ?? ""} placeholder="Count"
                               onChange={(ev) => set(p, { value: ev.target.value })} />
                        {hasBuyUnit(p) ? (
                          <Select value={e?.unit ?? "stock"} onValueChange={(v) => set(p, { unit: v as Entry["unit"] })}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stock">{p.uom ?? "PCS"}</SelectItem>
                              <SelectItem value="buy">{p.purchase_uom}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground w-10">{p.uom ?? "PCS"}</span>}
                      </div>
                      {e?.unit === "buy" && c !== null && !Number.isNaN(c) && (
                        <div className="text-xs text-muted-foreground mt-1">= {fmt(c)} {p.uom}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {diff === null ? <span className="text-muted-foreground">—</span>
                        : diff === 0 ? <span className="text-muted-foreground">No change</span>
                        : <span className={diff > 0 ? "text-success" : "text-destructive"}>{diff > 0 ? "+" : ""}{fmt(diff)}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {diff !== null && diff !== 0 && (
                        <Select value={e?.reason || ""} onValueChange={(v) => set(p, { reason: v })}>
                          <SelectTrigger className={cn("w-44", !e?.reason && "border-destructive")}><SelectValue placeholder="Choose reason" /></SelectTrigger>
                          <SelectContent>
                            {REASONS.filter((r) => r.code !== "OPENING_STOCK" || sys === 0).map((r) => (
                              <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {diff !== null && diff !== 0 && (
                        <Input className="w-36" placeholder="Optional" value={e?.remarks ?? ""} onChange={(ev) => set(p, { remarks: ev.target.value })} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)}>Next</Button>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-6 px-6 py-3 border-t bg-background flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <span className="font-medium">{lines.length}</span> counted ·{" "}
            <span className="font-medium">{changes.length}</span> change stock
            {openingCount > 0 && <> · {openingCount} opening</>}
          </div>
          {missingReason.length > 0 && (
            <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" /> {missingReason.length} need a reason</Badge>
          )}
          {invalid.length > 0 && <Badge variant="destructive">{invalid.length} not a valid number</Badge>}
          <Button className="ml-auto" disabled={!canPost} onClick={() => setConfirmOpen(true)}>
            <CheckCircle /> Post {changes.length || ""} line{changes.length === 1 ? "" : "s"}
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Post this count?</AlertDialogTitle>
              <AlertDialogDescription>
                {changes.length} part{changes.length === 1 ? "" : "s"} will be set to the counted quantity
                {openingCount > 0 ? `, ${openingCount} of them as opening stock` : ""}. Parts whose count matches the system
                are skipped. The adjustment is worked out against the stock at the moment of posting, and every line
                goes into the log book.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={post.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={post.isPending} onClick={(ev) => { ev.preventDefault(); post.mutate(); }}>
                {post.isPending ? "Posting…" : "Post"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default StockReconciliation;
