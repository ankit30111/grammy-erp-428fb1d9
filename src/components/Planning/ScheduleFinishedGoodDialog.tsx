import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { useScheduleFinishedGood } from "@/hooks/useProductionSchedules";
import { useSubAssemblyPositions, type SubAssemblyPosition } from "@/hooks/useSubAssemblyPositions";

const today = () => format(new Date(), "yyyy-MM-dd");
const n = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 3 });

type Choice = { mode: "use" | "new"; qty: string; date: string };

/** The day before the finished good, but never in the past. */
const subDate = (fgDate: string) => {
  if (!fgDate) return today();
  const d = format(addDays(parseISO(fgDate), -1), "yyyy-MM-dd");
  return d < today() ? today() : d;
};

/**
 * Schedule a finished good from its projection. For every sub-assembly on its
 * BOM the planner sees what is already in store or being built - including
 * units built or held for another product - and decides: use that, or issue a
 * new sub-assembly voucher for this production.
 */
export const ScheduleFinishedGoodDialog = ({
  projection, open, onOpenChange,
}: { projection: any | null; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { rows: lines } = useProductionLinesList();
  const { data: positions = [], isLoading } = useSubAssemblyPositions();
  const schedule = useScheduleFinishedGood();

  const balance = projection ? Number(projection.quantity) - Number(projection.scheduled_quantity || 0) : 0;
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState("");
  const [lineId, setLineId] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  useEffect(() => {
    if (!open) return;
    setQuantity(balance > 0 ? String(balance) : "");
    setDate("");
    setLineId("");
    setChoices({});
  }, [open, projection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = Number(quantity) || 0;
  const fgId = projection?.part_id;

  // The sub-assemblies on this product's BOM, with what this production needs of each.
  const subs = useMemo(
    () => positions
      .map((p) => ({ pos: p, qps: p.usedIn.find((u) => u.id === fgId)?.qps ?? 0 }))
      .filter((s) => s.qps > 0)
      .map((s) => ({ ...s, need: qty * s.qps })),
    [positions, fgId, qty],
  );

  const defaultChoice = (pos: SubAssemblyPosition, need: number): Choice => {
    const short = Math.max(0, need - Math.max(0, pos.free));
    return short > 0 && pos.hasBom
      ? { mode: "new", qty: String(short), date: subDate(date) }
      : { mode: "use", qty: String(short || need), date: subDate(date) };
  };
  const choiceFor = (pos: SubAssemblyPosition, need: number) => choices[pos.id] ?? defaultChoice(pos, need);
  const setChoice = (id: string, c: Partial<Choice>, pos: SubAssemblyPosition, need: number) =>
    setChoices((all) => ({ ...all, [id]: { ...choiceFor(pos, need), ...c } }));

  const qtyOk = qty > 0 && qty <= balance;
  const newOnes = subs
    .map(({ pos, need }) => ({ pos, c: choiceFor(pos, need) }))
    .filter(({ c }) => c.mode === "new");
  const newOk = newOnes.every(({ pos, c }) => pos.hasBom && Number(c.qty) > 0 && c.date);
  const canSubmit = !!projection && qtyOk && !!date && newOk && !schedule.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    await schedule.mutateAsync({
      projection_id: projection.id,
      quantity: qty,
      scheduled_date: date,
      production_line_id: lineId || null,
      subassemblies: newOnes.map(({ pos, c }) => ({ part_id: pos.id, quantity: Number(c.qty), date: c.date })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Production</DialogTitle>
        </DialogHeader>

        {projection && (
          <div className="space-y-5 py-1">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">
                <span className="font-mono">{projection.parts?.part_code}</span> · {projection.parts?.name}
              </div>
              <div className="text-muted-foreground">
                {projection.customers?.name} · {projection.month ? format(parseISO(projection.month), "MMM yyyy") : ""} ·
                {" "}{n(balance)} of {n(Number(projection.quantity))} left to schedule
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fg-qty">Quantity *</Label>
                <Input id="fg-qty" type="number" min={1} max={balance} value={quantity}
                       onChange={(e) => { setQuantity(e.target.value); setChoices({}); }}
                       className={quantity && !qtyOk ? "border-destructive" : ""} />
                {quantity && !qtyOk && <p className="text-xs text-destructive">Between 1 and {n(balance)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Production date *</Label>
                <DatePicker value={date} min={today()}
                            onChange={(d) => { setDate(d); setChoices((all) => Object.fromEntries(
                              Object.entries(all).map(([k, c]) => [k, { ...c, date: subDate(d) }]))); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Production line</Label>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sub-assemblies on this product
              </h4>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Checking sub-assembly stock…</p>
              ) : subs.length === 0 ? (
                <p className="text-sm text-muted-foreground">This product has no sub-assemblies on its BOM.</p>
              ) : (
                <div className="space-y-3">
                  {subs.map(({ pos, qps, need }) => {
                    const c = choiceFor(pos, need);
                    const free = Math.max(0, pos.free);
                    const shortIfUsed = Math.max(0, need - free);
                    return (
                      <div key={pos.id} className="rounded-md border p-3 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">
                              <span className="font-mono">{pos.part_code}</span> · {pos.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {n(qps)} per set × {n(qty)} = <span className="font-semibold text-foreground">{n(need)} needed</span>
                            </div>
                          </div>
                          {!pos.hasBom && <Badge variant="destructive">No BOM</Badge>}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <Stat label="In store" value={n(pos.inStore)} />
                          <Stat label="Being built" value={n(pos.beingBuilt)} />
                          <Stat label="Held for other vouchers" value={n(pos.held)} />
                          <Stat label="Free to use" value={n(free)} strong />
                        </div>

                        {(pos.vouchers.length > 0 || pos.holds.length > 0) && (
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {pos.vouchers.map((v) => (
                              <li key={v.id}>
                                Being built: <span className="font-mono">{v.voucher_number}</span> × {n(v.quantity)} ·{" "}
                                {v.for_voucher ? <>for <span className="font-mono">{v.for_voucher}</span> ({v.for_product})</> : "stock build"}
                              </li>
                            ))}
                            {pos.holds.map((h) => (
                              <li key={h.order_id}>
                                Held: {n(h.quantity)} for <span className="font-mono">{h.voucher_number}</span> ({h.product_code})
                              </li>
                            ))}
                          </ul>
                        )}

                        <RadioGroup value={c.mode} onValueChange={(v) => setChoice(pos.id, { mode: v as Choice["mode"] }, pos, need)}
                                    className="gap-2">
                          <label className="flex items-start gap-2 text-sm cursor-pointer">
                            <RadioGroupItem value="use" className="mt-0.5" />
                            <span>
                              Use existing stock and open vouchers
                              {shortIfUsed > 0 && (
                                <span className="flex items-center gap-1 text-xs text-destructive">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Only {n(free)} free: short by {n(shortIfUsed)}. This kit cannot be issued until they are in store.
                                </span>
                              )}
                            </span>
                          </label>
                          <label className={`flex items-start gap-2 text-sm ${pos.hasBom ? "cursor-pointer" : "opacity-60"}`}>
                            <RadioGroupItem value="new" disabled={!pos.hasBom} className="mt-0.5" />
                            <span>
                              Issue a new sub-assembly voucher for this production
                              {!pos.hasBom && <span className="block text-xs">Add its BOM first.</span>}
                            </span>
                          </label>
                        </RadioGroup>

                        {c.mode === "new" && pos.hasBom && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                            <div className="space-y-1.5">
                              <Label>Quantity to build</Label>
                              <Input type="number" min={1} value={c.qty}
                                     onChange={(e) => setChoice(pos.id, { qty: e.target.value }, pos, need)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Build on</Label>
                              <DatePicker value={c.date} min={today()}
                                          onChange={(d) => setChoice(pos.id, { date: d }, pos, need)} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {schedule.isPending ? "Scheduling…" : newOnes.length
              ? `Schedule and issue ${newOnes.length + 1} vouchers`
              : "Schedule and issue voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="rounded border px-2 py-1">
    <div className="text-muted-foreground">{label}</div>
    <div className={strong ? "font-semibold" : ""}>{value}</div>
  </div>
);
