import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Edit, Factory, FileText, Search, Trash2 } from "lucide-react";
import {
  addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, parseISO, startOfMonth,
} from "date-fns";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { useSubAssemblyPositions, type SubAssemblyPosition } from "@/hooks/useSubAssemblyPositions";
import { VoucherMaterials } from "@/components/Production/VoucherMaterials";
import { EditScheduleDialog } from "@/components/Planning/EditScheduleDialog";
import { DeleteScheduleDialog } from "@/components/Planning/DeleteScheduleDialog";
import { ScheduleSubAssemblyDialog } from "@/components/Planning/ScheduleSubAssemblyDialog";
import { ScheduleFinishedGoodDialog } from "@/components/Planning/ScheduleFinishedGoodDialog";
import { cn } from "@/lib/utils";

const n = (v: number) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  KIT_PREPARED: "Kit prepared",
  KIT_SENT: "Kit issued",
  IN_PRODUCTION: "In production · PQC",
  COMPLETED: "Awaiting OQC",
  OQC_PASSED: "OQC passed",
  OQC_FAILED: "OQC failed",
  CANCELLED: "Cancelled",
};

/** One row per voucher, whatever it builds. */
type VoucherRow = {
  schedule: any;
  order: any;
  kind: "FG" | "SA";
  product: { id?: string; part_code?: string; name?: string } | undefined;
  forLabel: string;
  status: string;
};

const toVoucherRow = (s: any): VoucherRow => {
  const order = s.production_orders?.[0];
  const isFg = !!s.projection_id;
  return {
    schedule: s,
    order,
    kind: isFg ? "FG" : "SA",
    product: s.projections?.parts ?? s.parts,
    forLabel: isFg
      ? s.projections?.customers?.name ?? "—"
      : order?.parent?.voucher_number
        ? `For ${order.parent.voucher_number} · ${order.parent.part_code ?? ""}`
        : "Stock build",
    status: order?.status ?? s.status,
  };
};

/** A row of toggle buttons used as a filter. */
const Chips = ({ options, value, onChange }: {
  options: { id: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => (
      <Button key={o.id} size="sm" variant={value === o.id ? "default" : "outline"} onClick={() => onChange(o.id)}>
        {o.label}{o.count !== undefined && <span className="opacity-70">{o.count}</span>}
      </Button>
    ))}
  </div>
);

const TypeBadge = ({ kind }: { kind: "FG" | "SA" }) =>
  kind === "FG"
    ? <Badge className="whitespace-nowrap">Finished good</Badge>
    : <Badge variant="outline" className="whitespace-nowrap">Sub-assembly</Badge>;

const PlanningEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState("finished");

  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();
  const { data: positions = [], isLoading: positionsLoading } = useSubAssemblyPositions();

  // Dialogs
  const [fgProjection, setFgProjection] = useState<any>(null);
  const [saPart, setSaPart] = useState<SubAssemblyPosition | null>(null);
  const [voucherScheduleId, setVoucherScheduleId] = useState<string>("");
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<any>(null);

  // Filters
  const [saFamily, setSaFamily] = useState("all");
  const [saSearch, setSaSearch] = useState("");
  const [voucherType, setVoucherType] = useState("all");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const toSchedule = (projections as any[]).filter((p) => Number(p.quantity) - Number(p.scheduled_quantity || 0) > 0);
  const vouchers = useMemo(() => (schedules as any[]).map(toVoucherRow), [schedules]);

  // ---- Sub-assemblies ----
  const families = useMemo(() => {
    const all = new Map<string, number>();
    for (const p of positions) for (const f of p.families) all.set(f, (all.get(f) || 0) + 1);
    return [...all.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [positions]);
  const noBomCount = positions.filter((p) => !p.hasBom).length;
  const saRows = positions.filter((p) => {
    if (saFamily === "nobom" && p.hasBom) return false;
    if (saFamily !== "all" && saFamily !== "nobom" && !p.families.includes(saFamily)) return false;
    const q = saSearch.trim().toLowerCase();
    return !q || p.part_code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  // ---- Scheduled production ----
  // A finished-good voucher is followed by the sub-assembly vouchers issued for it.
  const voucherRows = useMemo(() => {
    const shown = vouchers.filter((v) => voucherType === "all" || v.kind === voucherType);
    if (voucherType !== "all") return shown.map((v) => ({ ...v, child: false }));
    const ids = new Set(shown.map((v) => v.order?.id).filter(Boolean));
    const childrenOf = new Map<string, VoucherRow[]>();
    for (const v of shown) {
      const parent = v.order?.parent_order_id;
      if (parent && ids.has(parent)) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), v]);
    }
    const out: (VoucherRow & { child: boolean })[] = [];
    for (const v of shown) {
      const parent = v.order?.parent_order_id;
      if (parent && ids.has(parent)) continue;
      out.push({ ...v, child: false });
      for (const c of childrenOf.get(v.order?.id) ?? []) out.push({ ...c, child: true });
    }
    return out;
  }, [vouchers, voucherType]);

  const getMaxQuantityForEdit = (schedule: any) => {
    // A sub-assembly has no projection to stay within.
    if (!schedule.projection_id) return Infinity;
    const projection = (projections as any[]).find((p) => p.id === schedule.projection_id);
    if (!projection) return 0;
    return Number(projection.quantity) - Number(projection.scheduled_quantity || 0) + Number(schedule.quantity || 0);
  };

  const voucherSchedule = (schedules as any[]).find((s) => s.id === voucherScheduleId);

  const tabs = [
    { id: "finished", label: "Finished Goods", count: toSchedule.length },
    { id: "subassemblies", label: "Sub-assemblies", count: positions.filter((p) => p.toMake > 0).length },
    { id: "scheduled", label: "Scheduled Production", count: vouchers.length },
    { id: "calendar", label: "Calendar" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Planning" />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />

      <div className="space-y-6 pt-4">
        {/* ---------------- Finished goods ---------------- */}
        {activeTab === "finished" && (
          <Card>
            <CardHeader>
              <CardTitle>Projections to schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {toSchedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">All projections have been scheduled</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Month</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Projected</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Scheduled</TableHead>
                      <TableHead className="text-right">Left</TableHead>
                      <TableHead className="text-right w-px">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {toSchedule.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.customers?.name}</TableCell>
                        <TableCell>
                          <div className="font-medium">{p.parts?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.parts?.part_code}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{p.month ? format(parseISO(p.month), "MMM yyyy") : ""}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right">{n(p.quantity)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right">{n(p.scheduled_quantity)}</TableCell>
                        <TableCell className="text-right font-semibold">{n(Number(p.quantity) - Number(p.scheduled_quantity || 0))}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setFgProjection(p)}>
                            <Factory /> Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---------------- Sub-assemblies ---------------- */}
        {activeTab === "subassemblies" && (
          <Card>
            <CardHeader>
              <CardTitle>Sub-assemblies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                <Chips
                  value={saFamily}
                  onChange={setSaFamily}
                  options={[
                    { id: "all", label: "All", count: positions.length },
                    ...families.map(([f, c]) => ({ id: f, label: f, count: c })),
                    ...(noBomCount ? [{ id: "nobom", label: "No BOM", count: noBomCount }] : []),
                  ]}
                />
                <div className="relative lg:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={saSearch} onChange={(e) => setSaSearch(e.target.value)} placeholder="Search code or name" className="pl-8" />
                </div>
              </div>

              {positionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : saRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sub-assemblies match</div>
              ) : (
                <Table>
                  <TableHeader className="[&_th]:whitespace-nowrap">
                    <TableRow>
                      <TableHead>Sub-assembly</TableHead>
                      <TableHead className="hidden xl:table-cell">Used in</TableHead>
                      <TableHead className="text-right">In store</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Being built</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Held</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Projections</TableHead>
                      <TableHead className="text-right">To make</TableHead>
                      <TableHead className="text-right w-px">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saRows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono flex flex-wrap items-center gap-2">
                            {p.part_code}
                            {!p.hasBom && <Badge variant="destructive">No BOM</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm">
                          {p.usedIn.length
                            ? p.usedIn.map((u) => <div key={u.id} className="font-mono whitespace-nowrap">{u.part_code}</div>)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">{n(p.inStore)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right">{n(p.beingBuilt)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right">{n(p.held)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right">{n(p.projectionNeed)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", p.toMake > 0 && "text-destructive")}>{n(p.toMake)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={p.toMake > 0 ? "default" : "outline"} disabled={!p.hasBom}
                                  title={p.hasBom ? undefined : "Add its BOM before scheduling"}
                                  onClick={() => setSaPart(p)}>
                            <Factory /> Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground">
                To make = held for finished-good vouchers + still to be vouchered on projections − in store − being built.
                A sub-assembly enters the store only after its OQC passes; its raw parts left the store with its own kit.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ---------------- Scheduled production ---------------- */}
        {activeTab === "scheduled" && (
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Production</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Chips
                value={voucherType}
                onChange={setVoucherType}
                options={[
                  { id: "all", label: "All", count: vouchers.length },
                  { id: "FG", label: "Finished goods", count: vouchers.filter((v) => v.kind === "FG").length },
                  { id: "SA", label: "Sub-assemblies", count: vouchers.filter((v) => v.kind === "SA").length },
                ]}
              />
              {voucherRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No scheduled production</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden lg:table-cell">For</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="text-right w-px">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voucherRows.map((v) => {
                      // Listed under the product only when the sub-assembly rows are filtered out.
                      const subs: any[] = voucherType === "FG" ? v.order?.subs ?? [] : [];
                      const editable = v.status === "PLANNED";
                      return (
                        <TableRow key={v.schedule.id} className={v.child ? "bg-muted/30" : undefined}>
                          <TableCell className={cn("whitespace-nowrap", v.child && "pl-8")}>
                            <div className="font-mono font-medium">{v.child && <span className="text-muted-foreground mr-1">↳</span>}{v.order?.voucher_number || "Generating…"}</div>
                            <div className="mt-1"><TypeBadge kind={v.kind} /></div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{v.product?.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{v.product?.part_code}</div>
                            {subs.length > 0 && (
                              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                {subs.map((s) => (
                                  <li key={s.id}>
                                    <span className="font-mono">{s.voucher_number}</span> · {s.parts?.part_code} × {n(s.quantity)} · {STATUS_LABEL[s.status] ?? s.status}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="lg:hidden text-xs text-muted-foreground mt-1">{v.forLabel}</div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{v.forLabel}</TableCell>
                          <TableCell className="text-right">{n(v.schedule.quantity)}</TableCell>
                          <TableCell className="hidden md:table-cell whitespace-nowrap">{format(parseISO(v.schedule.scheduled_date), "d MMM yyyy")}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={editable ? "secondary" : "outline"} className="whitespace-nowrap">{STATUS_LABEL[v.status] ?? v.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setVoucherScheduleId(v.schedule.id)}>
                                <FileText /> Voucher
                              </Button>
                              {editable && (
                                <>
                                  <Button variant="outline" size="icon" aria-label="Edit" onClick={() => setEditSchedule(v.schedule)}>
                                    <Edit />
                                  </Button>
                                  <Button variant="outline" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive"
                                          onClick={() => setDeleteSchedule(v.schedule)}>
                                    <Trash2 />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---------------- Calendar ---------------- */}
        {activeTab === "calendar" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>{format(month, "MMMM yyyy")}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
                <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Finished good</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-primary" /> Sub-assembly</span>
              </div>
              <MonthGrid month={month} vouchers={vouchers} onOpen={(id) => setVoucherScheduleId(id)} />
            </CardContent>
          </Card>
        )}
      </div>

      <ScheduleFinishedGoodDialog projection={fgProjection} open={!!fgProjection} onOpenChange={(o) => !o && setFgProjection(null)} />
      <ScheduleSubAssemblyDialog part={saPart} open={!!saPart} onOpenChange={(o) => !o && setSaPart(null)} />

      {editSchedule && (
        <EditScheduleDialog isOpen={!!editSchedule} onClose={() => setEditSchedule(null)}
                            schedule={editSchedule} maxQuantity={getMaxQuantityForEdit(editSchedule)} />
      )}
      {deleteSchedule && (
        <DeleteScheduleDialog isOpen={!!deleteSchedule} onClose={() => setDeleteSchedule(null)} schedule={deleteSchedule} />
      )}

      <Dialog open={!!voucherScheduleId} onOpenChange={(o) => !o && setVoucherScheduleId("")}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Production Voucher</DialogTitle>
          </DialogHeader>
          {voucherSchedule && (() => {
            const v = toVoucherRow(voucherSchedule);
            return (
              <div className="space-y-4">
                <div className="pb-3 border-b space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{v.product?.name}</h3>
                    <TypeBadge kind={v.kind} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono">{v.order?.voucher_number || "Generating…"}</span> · {n(voucherSchedule.quantity)} units ·{" "}
                    {format(parseISO(voucherSchedule.scheduled_date), "d MMM yyyy")} · {v.forLabel} · {STATUS_LABEL[v.status] ?? v.status}
                  </p>
                </div>
                <VoucherMaterials
                  partId={v.product?.id}
                  quantity={Number(voucherSchedule.quantity) || 0}
                  plantId={voucherSchedule.plant_id}
                  productionOrderId={v.order?.id}
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

/** A month of vouchers. Each day is a fixed-height cell that scrolls if busy. */
const MonthGrid = ({ month, vouchers, onOpen }: { month: Date; vouchers: VoucherRow[]; onOpen: (scheduleId: string) => void }) => {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const cells: (Date | null)[] = [...Array(getDay(days[0])).fill(null), ...days];
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[640px]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="h-28 rounded border border-transparent" />;
          const day = vouchers.filter((v) => isSameDay(parseISO(v.schedule.scheduled_date), date));
          return (
            <div key={i} className={cn("h-28 rounded border p-1 overflow-y-auto", isToday(date) && "border-primary")}>
              <div className="text-xs font-medium mb-1">{format(date, "d")}</div>
              {day.map((v) => (
                <button key={v.schedule.id} type="button" onClick={() => onOpen(v.schedule.id)}
                        className={cn(
                          "block w-full text-left text-[11px] leading-tight rounded px-1 py-0.5 mb-1",
                          v.kind === "FG" ? "bg-primary text-primary-foreground" : "border border-primary text-foreground",
                        )}>
                  <div className="font-medium truncate">{v.product?.part_code}</div>
                  <div className="opacity-80">{n(v.schedule.quantity)} pcs</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanningEnhanced;
