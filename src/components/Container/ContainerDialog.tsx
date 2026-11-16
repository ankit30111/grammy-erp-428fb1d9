import { useMemo, useState } from "react";
import { Check, ExternalLink, Trash2, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { LDBService } from "@/utils/LDBService";
import {
  ContainerForm, ContainerStage, ImportContainer, ImportPoLine, STAGES, stageIndex, useImportMutations,
} from "@/hooks/useImports";

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const num = (v: number) => Number(v).toLocaleString("en-IN");
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const FIELDS: { key: keyof ContainerForm; label: string; type?: string; placeholder?: string }[] = [
  { key: "container_number", label: "Container number", placeholder: "e.g. MSCU1234567" },
  { key: "shipping_line", label: "Shipping line", placeholder: "e.g. MSC, Maersk" },
  { key: "vessel_name", label: "Vessel" },
  { key: "bl_number", label: "Bill of lading number" },
  { key: "invoice_number", label: "Supplier invoice number" },
  { key: "invoice_amount", label: "Invoice amount", type: "number" },
  { key: "currency", label: "Currency", placeholder: "USD" },
  { key: "freight_cost", label: "Freight", type: "number" },
  { key: "planned_loaded", label: "Expected loading", type: "date" },
  { key: "planned_factory", label: "Expected at factory", type: "date" },
];

const blank: ContainerForm = {
  container_number: "", shipping_line: "", vessel_name: "", bl_number: "", invoice_number: "", invoice_amount: "",
  currency: "", freight_cost: "", planned_loaded: "", planned_factory: "", notes: "",
};

/** The stage line: every stage with the date it was reached. */
export function StageTrack({ container, compact }: { container: ImportContainer; compact?: boolean }) {
  const at = stageIndex(container.current_status);
  return (
    <ol className={cn("flex", compact ? "gap-1" : "gap-0")}>
      {STAGES.map((s, i) => {
        const done = i <= at;
        if (compact) {
          return <li key={s.id} title={s.label} className={cn("h-1.5 w-5 rounded-full", done ? "bg-primary" : "bg-muted")} />;
        }
        return (
          <li key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= at ? "bg-primary" : "bg-border")} />
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === STAGES.length - 1 ? "opacity-0" : i < at ? "bg-primary" : "bg-border")} />
            </div>
            <span className={cn("text-xs leading-tight", i === at ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{fmtDate((container as any)[s.dateField]) || " "}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ContainerDialog({ container, presetPoId, poLines, canEdit, onClose }: {
  container: ImportContainer | null; presetPoId?: string | null; poLines: ImportPoLine[]; canEdit: boolean; onClose: () => void;
}) {
  const m = useImportMutations();
  const isNew = !container;
  const locked = container?.current_status === "AT_FACTORY";

  const [form, setForm] = useState<ContainerForm>(() => container ? {
    container_number: container.container_number, shipping_line: container.shipping_line ?? "", vessel_name: container.vessel_name ?? "",
    bl_number: container.bl_number ?? "", invoice_number: container.invoice_number ?? "",
    invoice_amount: container.invoice_amount?.toString() ?? "", currency: container.currency ?? "",
    freight_cost: container.freight_cost?.toString() ?? "", planned_loaded: container.planned_loaded ?? "",
    planned_factory: container.planned_factory ?? "", notes: container.notes ?? "",
  } : { ...blank, currency: poLines.find((l) => l.purchase_order_id === presetPoId)?.currency ?? "" });

  // What this container already carries, by PO line.
  const inThis = useMemo(() => new Map((container?.lines ?? []).filter((l) => l.purchase_order_item_id)
    .map((l) => [l.purchase_order_item_id as string, l])), [container]);

  const [qty, setQty] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    inThis.forEach((l, id) => { start[id] = String(l.quantity); });
    if (isNew && presetPoId) poLines.filter((l) => l.purchase_order_id === presetPoId && l.to_load > 0).forEach((l) => { start[l.po_item_id] = String(l.to_load); });
    return start;
  });
  const [cbm, setCbm] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    inThis.forEach((l, id) => { if (l.cbm_occupied != null) start[id] = String(l.cbm_occupied); });
    return start;
  });

  // Lines that can still be loaded, plus the ones already in this container.
  const rows = useMemo(() => poLines
    .map((l) => ({ ...l, max: l.to_load + Number(inThis.get(l.po_item_id)?.quantity ?? 0) }))
    .filter((l) => l.max > 0)
    .sort((a, b) => Number(b.purchase_order_id === presetPoId) - Number(a.purchase_order_id === presetPoId)
      || a.po_number.localeCompare(b.po_number) || a.part_code.localeCompare(b.part_code)), [poLines, inThis, presetPoId]);

  const picked = rows.filter((r) => Number(qty[r.po_item_id]) > 0);
  const over = picked.find((r) => Number(qty[r.po_item_id]) > r.max);
  const canSave = canEdit && form.container_number.trim().length > 0 && (locked || picked.length > 0) && !over && !m.save.isPending;

  const save = () => m.save.mutate({
    id: container?.id ?? null, header: form,
    lines: locked ? null : picked.map((r) => ({ purchase_order_item_id: r.po_item_id, quantity: Number(qty[r.po_item_id]), cbm: cbm[r.po_item_id] ?? "" })),
  }, { onSuccess: onClose });

  // Stage change
  const at = container ? stageIndex(container.current_status) : 0;
  const later = STAGES.slice(at + 1);
  const [nextStage, setNextStage] = useState<ContainerStage | "">(later[0]?.id ?? "");
  const [stageDate, setStageDate] = useState(today());

  // Indian container tracking (LDB)
  const [ldb, setLdb] = useState<{ loading: boolean; text?: string }>({ loading: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const checkLdb = async () => {
    setLdb({ loading: true });
    const r = await LDBService.fetchContainerStatus(form.container_number);
    setLdb({ loading: false, text: r.success ? [r.status, r.location, r.lastUpdate].filter(Boolean).join(" · ") || "No status returned" : r.error || "Could not read LDB" });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,1040px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New container" : <span className="font-mono">{container.container_number}</span>}</DialogTitle>
          <DialogDescription>
            {isNew ? "Pick the PO lines loaded in this container. Stages are updated after it is saved."
              : `${STAGES[at].label}${container.shipping_line ? ` · ${container.shipping_line}` : ""}`}
          </DialogDescription>
        </DialogHeader>

        {container && (
          <section className="space-y-3 rounded-md border p-4">
            <StageTrack container={container} />
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                {later.length > 0 && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Move to</Label>
                      <Select value={nextStage} onValueChange={(v) => setNextStage(v as ContainerStage)}>
                        <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{later.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="stage-date">On date</Label>
                      <Input id="stage-date" type="date" className="h-9 w-40" max={today()} value={stageDate} onChange={(e) => setStageDate(e.target.value)} />
                    </div>
                    <Button size="sm" className="h-9" disabled={!nextStage || !stageDate || m.setStage.isPending}
                            onClick={() => m.setStage.mutate({ id: container.id, stage: nextStage as ContainerStage, date: stageDate }, { onSuccess: onClose })}>
                      Update stage
                    </Button>
                  </>
                )}
                {at > 0 && (
                  <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" disabled={m.setStage.isPending}
                          onClick={() => m.setStage.mutate({ id: container.id, stage: STAGES[at - 1].id, date: null }, { onSuccess: onClose })}>
                    <Undo2 className="mr-1 h-4 w-4" /> Undo "{STAGES[at].label}"
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {ldb.text && <span className="max-w-[18rem] truncate" title={ldb.text}>{ldb.text}</span>}
                  <Button size="sm" variant="outline" className="h-9" disabled={ldb.loading} onClick={checkLdb}>{ldb.loading ? "Checking…" : "Check LDB status"}</Button>
                  <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" target="_blank" rel="noreferrer"
                     href={LDBService.getLDBSearchUrl(container.container_number)}>Open LDB <ExternalLink className="h-3 w-3" /></a>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs" htmlFor={`c-${f.key}`}>{f.label}</Label>
              <Input id={`c-${f.key}`} type={f.type ?? "text"} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined}
                     placeholder={f.placeholder} disabled={!canEdit} value={form[f.key]}
                     onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs" htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" rows={1} disabled={!canEdit} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">What this container carries</h3>
            <span className="text-xs text-muted-foreground">
              {locked ? "At factory: lines are closed." : "Enter a quantity against each PO line loaded. Leave blank if it is not in this container."}
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead><TableHead>Part</TableHead><TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Can load</TableHead><TableHead className="w-32 text-right">In this container</TableHead>
                  <TableHead className="w-28 text-right">CBM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows.length ? (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No import PO line is waiting to be loaded.</TableCell></TableRow>
                ) : rows.map((r) => {
                  const q = Number(qty[r.po_item_id] ?? 0);
                  return (
                    <TableRow key={r.po_item_id} className={q > 0 ? "bg-primary/5" : undefined}>
                      <TableCell className="whitespace-nowrap text-sm"><div className="font-mono">{r.po_number}</div><div className="text-xs text-muted-foreground">{r.vendor_name}</div></TableCell>
                      <TableCell className="text-sm"><span className="font-mono">{r.part_code}</span> <span className="text-muted-foreground">{r.part_name}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.ordered)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.max)} <span className="text-xs text-muted-foreground">{r.uom ?? ""}</span></TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} max={r.max} step="any" disabled={!canEdit || locked} aria-label={`Quantity of ${r.part_code}`}
                               className={cn("h-8 text-right tabular-nums", q > r.max && "border-destructive")}
                               value={qty[r.po_item_id] ?? ""} onChange={(e) => setQty({ ...qty, [r.po_item_id]: e.target.value })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} step="any" disabled={!canEdit || locked || !(q > 0)} aria-label={`CBM of ${r.part_code}`} className="h-8 text-right tabular-nums"
                               value={cbm[r.po_item_id] ?? ""} onChange={(e) => setCbm({ ...cbm, [r.po_item_id]: e.target.value })} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {over && <p className="text-sm text-destructive">{over.part_code}: only {num(over.max)} can be loaded.</p>}
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {container && canEdit && container.current_status === "ORDERED" && (
              <Button variant="ghost" className="text-destructive" disabled={m.remove.isPending}
                      onClick={() => (confirmDelete ? m.remove.mutate(container.id, { onSuccess: onClose }) : setConfirmDelete(true))}>
                <Trash2 className="mr-1 h-4 w-4" /> {confirmDelete ? "Click again to delete for good" : "Delete container"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {canEdit && <Button disabled={!canSave} onClick={save}>{isNew ? "Create container" : "Save"}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
