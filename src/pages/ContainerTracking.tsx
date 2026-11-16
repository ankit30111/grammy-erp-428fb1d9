import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Ship } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { useAuth } from "@/contexts/AuthContext";
import { ContainerDialog, StageTrack } from "@/components/Container/ContainerDialog";
import { ImportContainer, ImportPoLine, STAGES, stageIndex, useContainerTimes, useImportContainers, useImportPoLines } from "@/hooks/useImports";

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const num = (v: number | null | undefined) => (v == null ? "" : Number(v).toLocaleString("en-IN"));

/**
 * Import tracking. An import purchase starts as a PO ticked "Imported purchase".
 * Approved import POs are listed here; their lines are loaded into containers,
 * and each container is followed until it reaches the factory.
 */
export default function ContainerTracking() {
  const { canAccessModule, isAdmin } = useAuth() as any;
  const canEdit = isAdmin || !!canAccessModule?.("purchase");
  const [tab, setTab] = useState("pos");
  const { data: lines = [], isLoading: loadingLines } = useImportPoLines();
  const { data: containers = [], isLoading: loadingContainers } = useImportContainers();
  const [dialog, setDialog] = useState<{ container: ImportContainer | null; poId?: string | null } | null>(null);

  const pos = useMemo(() => {
    const byPo = new Map<string, ImportPoLine[]>();
    for (const l of lines) byPo.set(l.purchase_order_id, [...(byPo.get(l.purchase_order_id) ?? []), l]);
    return [...byPo.values()];
  }, [lines]);

  const onTheWay = containers.filter((c) => c.current_status !== "AT_FACTORY");
  const { data: times = [] } = useContainerTimes();
  // Average days per leg, from containers that have completed that leg.
  const avg = (key: "days_to_load" | "days_at_sea" | "days_port_to_factory" | "days_loaded_to_factory" | "days_late") => {
    const v = times.map((t) => t[key]).filter((d): d is number => d != null);
    return v.length ? { days: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, n: v.length } : null;
  };
  const legs: [string, ReturnType<typeof avg>][] = [
    ["Order to loading", avg("days_to_load")], ["At sea", avg("days_at_sea")], ["Port to factory", avg("days_port_to_factory")],
    ["Loading to factory", avg("days_loaded_to_factory")], ["Later than expected", avg("days_late")],
  ];
  const tabs = [
    { id: "pos", label: "Import POs", count: pos.length },
    { id: "containers", label: "Containers", count: onTheWay.length },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Import Tracking"
        actions={canEdit && (
          <Button onClick={() => setDialog({ container: null })} disabled={!lines.some((l) => l.received < l.ordered)}>
            <Plus className="mr-2 h-4 w-4" /> New container
          </Button>
        )}
      />
      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      <div className="space-y-4 pt-4">
        {tab === "pos" && (loadingLines ? <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          : !pos.length ? (
            <Card><CardContent className="space-y-2 py-10 text-center">
              <Ship className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No approved import PO yet</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Create a PO in <Link className="underline underline-offset-2" to="/purchase?tab=create-po">Purchase</Link> and tick
                "Imported purchase". Once it is approved it appears here, ready to be loaded into a container.
              </p>
            </CardContent></Card>
          ) : pos.map((po) => {
            const h = po[0], left = po.reduce((n, l) => n + l.to_load, 0);
            return (
              <Card key={h.purchase_order_id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-base font-semibold">{h.po_number}</span>
                        <span>{h.vendor_name}</span>
                        {h.origin_country && <Badge variant="outline">{h.origin_country}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PO date {fmtDate(h.po_date)}{h.promised_loading_date ? ` · promised loading ${fmtDate(h.promised_loading_date)}` : ""}
                        {h.promised_delivery_date ? ` · promised delivery ${fmtDate(h.promised_delivery_date)}` : ""}
                      </p>
                    </div>
                    {left > 0 ? (canEdit && <Button size="sm" variant="outline" onClick={() => setDialog({ container: null, poId: h.purchase_order_id })}>Load into a container</Button>)
                      : <Badge variant="secondary">Fully loaded</Badge>}
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part</TableHead><TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Not loaded yet</TableHead><TableHead className="text-right">On the way</TableHead>
                          <TableHead className="text-right">Received (GRN)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {po.map((l) => (
                          <TableRow key={l.po_item_id}>
                            <TableCell className="text-sm"><span className="font-mono">{l.part_code}</span> <span className="text-muted-foreground">{l.part_name}</span></TableCell>
                            <TableCell className="text-right tabular-nums">{num(l.ordered)} <span className="text-xs text-muted-foreground">{l.uom ?? ""}</span></TableCell>
                            <TableCell className="text-right tabular-nums">{l.to_load > 0 ? num(l.to_load) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{l.on_the_way > 0 ? num(l.on_the_way) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{l.received > 0 ? num(l.received) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          }))}

        {tab === "containers" && (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border md:grid-cols-5">
            {legs.map(([label, a]) => (
              <div key={label} className="bg-card px-3 py-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold tabular-nums">{a ? `${a.days} days` : "—"}</div>
                <div className="text-[11px] text-muted-foreground">{a ? `average of ${a.n} container${a.n === 1 ? "" : "s"}` : "no container yet"}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "containers" && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Container</TableHead><TableHead>PO</TableHead><TableHead>Stage</TableHead>
                      <TableHead>Where it is</TableHead><TableHead>Expected at factory</TableHead><TableHead className="text-right">Freight</TableHead>
                      <TableHead className="text-right">Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingContainers ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                      : !containers.length ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No container yet. Load an import PO into one from the Import POs tab.</TableCell></TableRow>
                      : containers.map((c) => {
                        const at = stageIndex(c.current_status), s = STAGES[at];
                        const poNos = [...new Set(c.lines.map((l) => l.po_item?.purchase_order?.po_number).filter(Boolean))];
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => setDialog({ container: c })}>
                            <TableCell>
                              <div className="font-mono font-medium">{c.container_number}</div>
                              <div className="text-xs text-muted-foreground">{[c.shipping_line, c.vessel_name].filter(Boolean).join(" · ") || "—"}</div>
                            </TableCell>
                            <TableCell className="text-sm"><span className="font-mono">{poNos.join(", ") || "—"}</span>
                              <div className="text-xs text-muted-foreground">{c.lines.length} line(s)</div></TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{s.label}{(c as any)[s.dateField] ? <span className="ml-2 font-normal text-muted-foreground">{fmtDate((c as any)[s.dateField])}</span> : null}</div>
                              <div className="mt-1.5"><StageTrack container={c} compact /></div>
                            </TableCell>
                            <TableCell className="max-w-[14rem] text-sm">
                              <div className="truncate">{c.last_location || "—"}</div>
                              {c.last_tracked_at && <div className="text-xs text-muted-foreground">checked {fmtDate(c.last_tracked_at)}</div>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{fmtDate(c.eta ?? c.planned_factory) || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(c.freight_cost) || "—"}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{c.invoice_amount != null ? `${c.currency ?? ""} ${num(c.invoice_amount)}`.trim() : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {dialog && <ContainerDialog key={dialog.container?.id ?? dialog.poId ?? "new"} container={dialog.container} presetPoId={dialog.poId}
                                  poLines={lines} canEdit={canEdit} onClose={() => setDialog(null)} />}
    </DashboardLayout>
  );
}
