import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Check = { area: string; rule: string; status: "OK" | "WARN" | "ERROR"; records: number | null; detail: string | null };
type MapTable = { name: string; rows: number; last: string | null; about: string | null };
type SystemMap = { read_at: string; tables: MapTable[]; links: { from: string; to: string }[]; checks: Check[]; database_size: string };

/** Which part of the business each table belongs to, in the order the data flows. */
const AREAS: [string, string[]][] = [
  ["Masters", ["parts", "bom", "bom_brand_lines", "bom_change_requests", "brand_sync_issues", "brands", "part_brands", "part_categories", "part_specifications", "part_vendors", "released_part_codes", "document_counters", "customers", "customer_warehouses", "customer_brands", "vendors", "vendor_contacts", "plants", "production_lines"]],
  ["R&D", ["plm_products", "plm_gates", "plm_deliverables", "plm_deliverable_template", "plm_tests", "plm_issues", "plm_crs", "plm_crs_values", "item_versions", "version_lines", "ecns", "ecn_bom_swaps", "software_releases"]],
  ["Planning", ["projections", "production_schedules", "shortages"]],
  ["Purchase", ["purchase_orders", "purchase_order_items", "import_containers", "container_materials", "import_container_events", "grn", "grn_items", "grn_variance_resolutions"]],
  ["Stock", ["stock_ledger", "stock_balance", "stock_locations", "stock_holds", "kit_preparation", "kit_items", "kit_feedback", "kit_returns", "material_requests", "material_movement_log", "finished_goods_inventory"]],
  ["Production", ["production_orders", "production_order_lines", "hourly_production", "serial_number_assignments"]],
  ["Quality", ["pqc_reports", "line_rejections", "capa", "rca_reports", "vendor_notifications", "customer_complaints", "customer_complaint_parts", "complaint_receipts", "complaint_receipt_items"]],
  ["Sales", ["dispatch_orders", "dispatch_order_items", "spare_orders", "spare_order_items"]],
  ["HR", ["employees", "attendance", "payroll", "performance_reviews", "skills", "employee_skills", "training_programs", "employee_training"]],
  ["Access", ["user_accounts", "departments", "department_permissions", "user_departments", "user_plants", "approval_workflows", "audit_logs"]],
];
/** The table a failed check points at, by the check's area. */
const CHECK_TABLE: Record<string, string> = {
  Stock: "stock_ledger", BOM: "bom", Branding: "part_brands", Production: "production_orders", Masters: "parts", Purchase: "purchase_orders", Access: "user_accounts",
};

const W = 1200, H = 880;
// The map is a deliberate single look: a night sky, whatever the app's theme.
const SKY = { bg: "#0a1316", grid: "#12242a", link: "#3d6068", linkOn: "#7fd6df", text: "#c9dde0", dim: "#6f8a8f", live: "#57c7d1", quiet: "#2f7f88", empty: "#3a5459", warn: "#e8b560", bad: "#f0766b" };

const num = (v: number) => Number(v).toLocaleString("en-IN");
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/**
 * System map: every table as a point, grouped by the part of the business it
 * serves, with the links between them, read live from the database. A point is
 * bright when it holds records that changed recently, hollow when it is empty,
 * and ringed when a check that follows its records has failed.
 */
const SystemCheck = () => {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["system-map"],
    queryFn: async (): Promise<SystemMap> => {
      const { data, error } = await (supabase as any).rpc("system_map");
      if (error) throw error;
      return data as SystemMap;
    },
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const checks = data?.checks ?? [];
  const errors = checks.filter((r) => r.status === "ERROR").length;
  const warns = checks.filter((r) => r.status === "WARN").length;
  const checkAreas = [...new Set(checks.map((r) => r.area))];

  // Where every point sits: areas round an ellipse, tables in rings round each area.
  const layout = useMemo(() => {
    const byName = new Map((data?.tables ?? []).map((t) => [t.name, t]));
    const known = new Set(AREAS.flatMap(([, names]) => names));
    // Biggest table first, so it sits in the middle of its group and carries the group's label.
    const bySize = (a: string, b: string) => (byName.get(b)?.rows ?? 0) - (byName.get(a)?.rows ?? 0);
    const areas = AREAS.map(([name, names]) => [name, names.filter((n) => byName.has(n)).sort(bySize)] as [string, string[]]);
    const other = [...byName.keys()].filter((n) => !known.has(n));
    if (other.length) areas.push(["Other", other.sort(bySize)]);

    const pos = new Map<string, { x: number; y: number; area: string }>();
    const lead = new Set<string>();
    const centres: { name: string; x: number; y: number; r: number }[] = [];
    areas.forEach(([name, names], i) => {
      const a = (i / areas.length) * Math.PI * 2 - Math.PI * 0.72;
      const cx = W / 2 + Math.cos(a) * (W * 0.38), cy = H / 2 + 8 + Math.sin(a) * (H * 0.36);
      if (names.length && (byName.get(names[0])?.rows ?? 0) > 0) lead.add(names[0]);
      let placed = 0, ring = 0, outer = 0;
      while (placed < names.length) {
        const cap = ring === 0 ? 1 : ring * 6, rr = ring * 32;
        const take = Math.min(cap, names.length - placed);
        for (let k = 0; k < take; k++) {
          const t = (k / take) * Math.PI * 2 + ring * 0.5;
          pos.set(names[placed + k], { x: cx + Math.cos(t) * rr, y: cy + Math.sin(t) * rr, area: name });
        }
        placed += take; outer = rr; ring++;
      }
      centres.push({ name, x: cx, y: cy, r: outer + 24 });
    });
    return { pos, centres, byName, lead };
  }, [data]);

  const flagged = useMemo(() => {
    const m = new Map<string, "WARN" | "ERROR">();
    for (const c of checks) {
      if (c.status === "OK") continue;
      const t = CHECK_TABLE[c.area];
      if (t && (c.status === "ERROR" || !m.has(t))) m.set(t, c.status);
    }
    return m;
  }, [checks]);

  const focus = hover ?? picked;
  const links = data?.links ?? [];
  const near = useMemo(() => {
    const s = new Set<string>();
    if (focus) for (const l of links) { if (l.from === focus) s.add(l.to); if (l.to === focus) s.add(l.from); }
    return s;
  }, [focus, links]);

  const tables = data?.tables ?? [];
  const inUse = tables.filter((t) => t.rows > 0).length;
  const sel = picked ? layout.byName.get(picked) : null;
  const pointsTo = picked ? [...new Set(links.filter((l) => l.from === picked).map((l) => l.to))] : [];
  const pointedBy = picked ? [...new Set(links.filter((l) => l.to === picked).map((l) => l.from))] : [];

  return (
    <DashboardLayout>
      <PageHeader title="System Map" />
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
            {error ? <span className="text-sm text-destructive">{(error as any).message}</span>
              : errors ? <span className="flex items-center gap-2 font-medium text-destructive"><XCircle className="h-5 w-5" /> {errors} check{errors === 1 ? "" : "s"} failed</span>
              : <span className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-5 w-5" /> No check failed</span>}
            {warns > 0 && <span className="flex items-center gap-1.5 text-sm text-warning"><AlertTriangle className="h-4 w-4" /> {warns} to look at</span>}
            {data && <span className="text-sm text-muted-foreground">{tables.length} tables · {inUse} hold records · {links.length} links · {checks.length} checks · database {data.database_size}</span>}
            <span className="ml-auto text-sm text-muted-foreground">{data ? `Read ${format(new Date(data.read_at), "d MMM, HH:mm:ss")}` : ""}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} /> Read again
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-lg border" style={{ background: SKY.bg }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Every table and the links between them" onClick={() => setPicked(null)}>
              {layout.centres.map((c) => (
                <g key={c.name}>
                  <circle cx={c.x} cy={c.y} r={c.r} fill={SKY.grid} opacity={0.55} />
                  <text x={c.x} y={c.y - c.r - 8} textAnchor="middle" fontSize={13} fontWeight={600} letterSpacing="0.08em" fill={SKY.dim}>{c.name.toUpperCase()}</text>
                </g>
              ))}
              {links.map((l, i) => {
                const a = layout.pos.get(l.from), b = layout.pos.get(l.to);
                if (!a || !b) return null;
                const on = focus && (l.from === focus || l.to === focus);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? SKY.linkOn : SKY.link} strokeWidth={on ? 1.4 : 0.6} opacity={focus ? (on ? 0.95 : 0.06) : 0.28} />;
              })}
              {tables.map((t) => {
                const p = layout.pos.get(t.name);
                if (!p) return null;
                const recent = t.last && Date.now() - new Date(t.last).getTime() < 30 * 86_400_000;
                const r = 4.5 + Math.log10(t.rows + 1) * 2.6;
                const flag = flagged.get(t.name);
                const dim = focus && focus !== t.name && !near.has(t.name);
                const label = focus === t.name || near.has(t.name) || (!focus && layout.lead.has(t.name));
                return (
                  <g key={t.name} opacity={dim ? 0.25 : 1} style={{ cursor: "pointer", outline: "none" }} tabIndex={0} onFocus={() => setHover(t.name)} onBlur={() => setHover(null)} role="button" aria-label={`${t.name}, ${t.rows} rows`}
                     onMouseEnter={() => setHover(t.name)} onMouseLeave={() => setHover(null)}
                     onClick={(e) => { e.stopPropagation(); setPicked(t.name); }}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(t.name); } }}>
                    {flag && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={flag === "ERROR" ? SKY.bad : SKY.warn} strokeWidth={1.6} />}
                    <circle cx={p.x} cy={p.y} r={r} fill={t.rows === 0 ? SKY.bg : recent ? SKY.live : SKY.quiet} stroke={t.rows === 0 ? SKY.empty : picked === t.name ? "#ffffff" : "none"} strokeWidth={picked === t.name ? 2 : 1} />
                    <circle cx={p.x} cy={p.y} r={Math.max(r, 9)} fill="transparent" />
                    {label && <text x={p.x} y={p.y - r - 5} textAnchor="middle" fontSize={11} fill={SKY.text} fontFamily="ui-monospace, Menlo, monospace" style={{ pointerEvents: "none" }}>{t.name}</text>}
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 px-4 py-2 text-xs" style={{ color: SKY.dim }}>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SKY.live }} />Records changed in the last 30 days</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SKY.quiet }} />Holds records, quiet</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border align-middle" style={{ borderColor: SKY.empty }} />No records yet</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2 align-middle" style={{ borderColor: SKY.warn }} />A check here needs a look</span>
              <span>Bigger point = more records. A line = one table refers to the other.</span>
            </div>
          </div>

          <Card className="self-start">
            <CardContent className="space-y-3 p-4 text-sm">
              {!sel ? (
                <>
                  <h2 className="font-semibold">Pick a point</h2>
                  <p className="text-muted-foreground">Each point is one table. Hover to see what it is linked to; click to keep it selected.</p>
                  <p className="text-muted-foreground">The checks below follow records from one table to the next: stock back to its GRN, a GRN into stock, a voucher's hold to what is still to issue.</p>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="break-all font-mono font-semibold">{sel.name}</h2>
                    <p className="text-xs text-muted-foreground">{layout.pos.get(sel.name)?.area}</p>
                  </div>
                  {sel.about && <p>{sel.about}</p>}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">Records</dt><dd className="text-right tabular-nums">{num(sel.rows)}</dd>
                    <dt className="text-muted-foreground">Last change</dt><dd className="text-right">{sel.rows ? ago(sel.last) : "—"}</dd>
                  </dl>
                  {[["Refers to", pointsTo], ["Referred to by", pointedBy]].map(([title, list]) => (
                    <div key={title as string}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title as string} ({(list as string[]).length})</h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(list as string[]).length ? (list as string[]).map((n) => (
                          <button key={n} type="button" className="rounded border px-1.5 py-0.5 font-mono text-xs hover:border-primary hover:text-primary" onClick={() => setPicked(n)}>{n}</button>
                        )) : <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {checkAreas.map((area) => (
          <Card key={area}>
            <CardHeader className="pb-2"><CardTitle>{area}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.filter((r) => r.area === area).map((r) => (
                    <TableRow key={r.rule}>
                      <TableCell>
                        <div>{r.rule}</div>
                        {r.status !== "OK" && r.detail && <div className="mt-1 break-words text-xs text-muted-foreground">{r.detail}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "OK" ? "secondary" : r.status === "WARN" ? "warning" : "destructive"}>{r.status === "OK" ? "OK" : r.status === "WARN" ? "Look" : "Failed"}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{r.status === "OK" ? "—" : r.records}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SystemCheck;
