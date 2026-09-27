import React, { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Factory, FileText, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { VoucherMaterials } from "@/components/Production/VoucherMaterials";
import { EditScheduleDialog } from "@/components/Planning/EditScheduleDialog";
import { DeleteScheduleDialog } from "@/components/Planning/DeleteScheduleDialog";
import { ScheduleProductionForm, type ProductionKind } from "@/components/Planning/ScheduleProductionForm";
import { PlanningCalendar } from "@/components/Planning/PlanningCalendar";
import { STATUS_LABEL, toVoucherRow, type VoucherRow } from "@/components/Planning/voucherRows";
import { cn } from "@/lib/utils";

const n = (v: number) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

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
  const [activeTab, setActiveTab] = useState("schedule");

  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();

  const [preset, setPreset] = useState<{ kind?: ProductionKind; projectionId?: string; date?: string; key: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const prefill = (p: { kind?: ProductionKind; projectionId?: string; date?: string }) => {
    setPreset({ ...p, key: Date.now() });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [voucherScheduleId, setVoucherScheduleId] = useState<string>("");
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<any>(null);
  const [voucherType, setVoucherType] = useState("all");

  const toSchedule = (projections as any[]).filter((p) => Number(p.quantity) - Number(p.scheduled_quantity || 0) > 0);
  const vouchers = useMemo(() => (schedules as any[]).map(toVoucherRow), [schedules]);

  // A voucher is followed by the vouchers issued for it, at any depth:
  // finished good → Croma mic → printed tubes.
  const voucherRows = useMemo(() => {
    const shown = vouchers.filter((v) => voucherType === "all" || v.kind === voucherType);
    if (voucherType !== "all") return shown.map((v) => ({ ...v, depth: 0 }));
    const ids = new Set(shown.map((v) => v.order?.id).filter(Boolean));
    const childrenOf = new Map<string, VoucherRow[]>();
    for (const v of shown) {
      const parent = v.order?.parent_order_id;
      if (parent && ids.has(parent)) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), v]);
    }
    const out: (VoucherRow & { depth: number })[] = [];
    const push = (v: VoucherRow, depth: number) => {
      out.push({ ...v, depth });
      if (depth < 6) for (const c of childrenOf.get(v.order?.id) ?? []) push(c, depth + 1);
    };
    for (const v of shown) {
      const parent = v.order?.parent_order_id;
      if (parent && ids.has(parent)) continue;
      push(v, 0);
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
    { id: "schedule", label: "Schedule Production" },
    { id: "scheduled", label: "Productions Scheduled", count: vouchers.length },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Planning" />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />

      <div className="space-y-6 pt-4">
        {activeTab === "schedule" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Unscheduled Projections</CardTitle>
              </CardHeader>
              <CardContent>
                {toSchedule.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">All projections have been scheduled</div>
                ) : (
                  <div className="space-y-2">
                    {toSchedule.map((p: any) => {
                      const left = Number(p.quantity) - Number(p.scheduled_quantity || 0);
                      return (
                        <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
                          <div className="min-w-0">
                            <div className="font-medium">
                              {p.customers?.name} — <span className="font-mono">{p.parts?.part_code}</span> {p.parts?.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {p.month ? `${format(parseISO(p.month), "MMM yyyy")} · ` : ""}
                              Total {n(p.quantity)} · Scheduled {n(p.scheduled_quantity)} · Balance {n(left)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="whitespace-nowrap">{n(left)} remaining</Badge>
                            <Button size="sm" onClick={() => prefill({ kind: "FG", projectionId: p.id })}>
                              <Factory /> Schedule
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div ref={formRef} className="scroll-mt-4">
              <ScheduleProductionForm projections={projections as any[]} preset={preset} />
            </div>

            <PlanningCalendar vouchers={vouchers} onScheduleOn={(date) => prefill({ date })} />
          </>
        )}

        {activeTab === "scheduled" && (
          <Card>
            <CardHeader>
              <CardTitle>Productions Scheduled</CardTitle>
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
                <div className="text-center py-8 text-muted-foreground">No production scheduled yet</div>
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
                        <TableRow key={v.schedule.id} className={v.depth ? "bg-muted/30" : undefined}>
                          <TableCell className="whitespace-nowrap" style={v.depth ? { paddingLeft: 16 + v.depth * 20 } : undefined}>
                            <div className="font-mono font-medium">{v.depth > 0 && <span className="text-muted-foreground mr-1">↳</span>}{v.order?.voucher_number || "Generating…"}</div>
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
                          <TableCell className="hidden lg:table-cell text-sm min-w-[11rem]">{v.forLabel}</TableCell>
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

      </div>

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

export default PlanningEnhanced;
