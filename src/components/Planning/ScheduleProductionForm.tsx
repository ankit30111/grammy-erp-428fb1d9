import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, Check, ChevronsUpDown, Factory } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { useCreateStockBuild, useScheduleFinishedGood } from "@/hooks/useProductionSchedules";
import { CLOSED_VOUCHER_STATES, useSubAssemblyPositions, type SubAssemblyPosition } from "@/hooks/useSubAssemblyPositions";
import { cn } from "@/lib/utils";

export type ProductionKind = "FG" | "SA";

const today = () => format(new Date(), "yyyy-MM-dd");
const n = (v: number) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const STOCK = "__stock__";

type Choice = { mode: "use" | "new"; qty: string; date: string };

/** The day before the finished good, but never in the past. */
const subDate = (fgDate: string) => {
  if (!fgDate) return today();
  const d = format(addDays(parseISO(fgDate), -1), "yyyy-MM-dd");
  return d < today() ? today() : d;
};

interface Props {
  projections: any[];
  /** Set from outside (a projection row or a calendar day); the form takes it over. */
  preset?: { kind?: ProductionKind; projectionId?: string; date?: string; key: number } | null;
}

/**
 * One form for every voucher: pick Finished Good (from a projection) or
 * Sub-assembly (from the sub-assembly list), search and choose, set the date,
 * schedule. For a finished good, every sub-assembly on its BOM is checked:
 * use what is in store or being built, or issue a new voucher for it.
 */
export const ScheduleProductionForm = ({ projections, preset }: Props) => {
  const plantId = usePlantId();
  const { rows: lines } = useProductionLinesList();
  const { data: positions = [] } = useSubAssemblyPositions();
  const scheduleFg = useScheduleFinishedGood();
  const scheduleSa = useCreateStockBuild();

  const [kind, setKind] = useState<ProductionKind>("FG");
  const [itemId, setItemId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState("");
  const [lineId, setLineId] = useState("");
  const [forOrder, setForOrder] = useState(STOCK);
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const reset = (k: ProductionKind) => {
    setKind(k); setItemId(""); setQuantity(""); setLineId(""); setForOrder(STOCK); setChoices({});
  };

  useEffect(() => {
    if (!preset) return;
    if (preset.kind && (preset.kind !== kind || preset.projectionId)) reset(preset.kind);
    if (preset.projectionId) pickProjection(preset.projectionId);
    if (preset.date) setDate(preset.date);
  }, [preset?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = projections.filter((p) => Number(p.quantity) - Number(p.scheduled_quantity || 0) > 0);
  const balanceOf = (p: any) => Number(p.quantity) - Number(p.scheduled_quantity || 0);
  const projection = kind === "FG" ? open.find((p) => p.id === itemId) : undefined;
  const sub = kind === "SA" ? positions.find((p) => p.id === itemId) : undefined;

  const pickProjection = (id: string) => {
    setItemId(id);
    const p = projections.find((x) => x.id === id);
    setQuantity(p ? String(balanceOf(p)) : "");
    setChoices({});
  };
  const pickSub = (id: string) => {
    setItemId(id);
    const p = positions.find((x) => x.id === id);
    setQuantity(p && p.toMake > 0 ? String(p.toMake) : "");
    setForOrder(STOCK);
  };

  const qty = Number(quantity) || 0;
  const maxQty = projection ? balanceOf(projection) : Infinity;
  const qtyOk = qty > 0 && qty <= maxQty;

  // Finished good: the sub-assemblies on its BOM and what this production needs of each.
  const subs = useMemo(
    () => !projection ? [] : positions
      .map((p) => ({ pos: p, qps: p.usedIn.find((u) => u.id === projection.part_id)?.qps ?? 0 }))
      .filter((s) => s.qps > 0)
      .map((s) => ({ ...s, need: qty * s.qps })),
    [positions, projection, qty],
  );
  const defaultChoice = (pos: SubAssemblyPosition, need: number): Choice => {
    const short = Math.max(0, need - Math.max(0, pos.free));
    return short > 0 && pos.hasBom
      ? { mode: "new", qty: String(short), date: subDate(date) }
      : { mode: "use", qty: String(short || need), date: subDate(date) };
  };
  const choiceFor = (pos: SubAssemblyPosition, need: number) => choices[pos.id] ?? defaultChoice(pos, need);
  const setChoice = (pos: SubAssemblyPosition, need: number, c: Partial<Choice>) =>
    setChoices((all) => ({ ...all, [pos.id]: { ...choiceFor(pos, need), ...c } }));
  const newOnes = subs.map(({ pos, need }) => ({ pos, c: choiceFor(pos, need) })).filter(({ c }) => c.mode === "new");

  // Sub-assembly: open finished-good vouchers that use it, to build it for.
  const usedInIds = sub?.usedIn.map((u) => u.id) ?? [];
  const { data: parents = [] } = useQuery({
    queryKey: ["fg-vouchers-using", sub?.id, plantId],
    enabled: !!sub && !!plantId && usedInIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("production_orders")
        .select("id, voucher_number, quantity, parts!part_id ( part_code )")
        .eq("plant_id", plantId).in("part_id", usedInIds)
        .not("status", "in", `(${CLOSED_VOUCHER_STATES.join(",")})`)
        .order("planned_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pending = scheduleFg.isPending || scheduleSa.isPending;
  const canSubmit = !!itemId && qtyOk && !!date && !pending
    && (kind === "SA" ? !!sub?.hasBom : newOnes.every(({ pos, c }) => pos.hasBom && Number(c.qty) > 0 && c.date));

  const submit = async () => {
    if (!canSubmit) return;
    if (kind === "FG" && projection) {
      await scheduleFg.mutateAsync({
        projection_id: projection.id,
        quantity: qty,
        scheduled_date: date,
        production_line_id: lineId || null,
        subassemblies: newOnes.map(({ pos, c }) => ({ part_id: pos.id, quantity: Number(c.qty), date: c.date })),
      });
    } else if (sub) {
      await scheduleSa.mutateAsync({
        part_id: sub.id,
        quantity: qty,
        scheduled_date: date,
        production_line_id: lineId || null,
        parent_order_id: forOrder === STOCK ? null : forOrder,
      });
    }
    reset(kind);
    setDate("");
  };

  const pickerLabel = projection
    ? `${projection.customers?.name} — ${projection.parts?.part_code} ${projection.parts?.name}`
    : sub ? `${sub.part_code} — ${sub.name}`
    : kind === "FG" ? "Choose a customer projection" : "Choose a sub-assembly";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Production</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Schedule production for</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={kind === "FG" ? "default" : "outline"} onClick={() => reset("FG")}>Finished Good</Button>
            <Button type="button" variant={kind === "SA" ? "default" : "outline"} onClick={() => reset("SA")}>Sub-assembly</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <div className="space-y-1.5 min-w-0">
            <Label>{kind === "FG" ? "Customer projection *" : "Sub-assembly *"}</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline"
                        className={cn("w-full justify-between normal-case tracking-normal font-normal text-sm min-h-10 text-left", !itemId && "text-muted-foreground")}>
                  <span className="truncate">{pickerLabel}</span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="start">
                {/* Plain "contains" search: typing a code or a word finds exactly those. */}
                <Command filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
                  <CommandInput placeholder={kind === "FG" ? "Search customer, code or product…" : "Search code or name…"} />
                  <CommandList>
                    <CommandEmpty>{kind === "FG" ? "No projection left to schedule." : "No sub-assembly found."}</CommandEmpty>
                    <CommandGroup>
                      {kind === "FG"
                        ? open.map((p) => (
                            <CommandItem key={p.id} value={`${p.customers?.name} ${p.parts?.part_code} ${p.parts?.name} ${p.id}`}
                                         onSelect={() => { pickProjection(p.id); setPickerOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", p.id === itemId ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0">
                                <div className="truncate">{p.customers?.name} — <span className="font-mono">{p.parts?.part_code}</span> {p.parts?.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.month ? format(parseISO(p.month), "MMM yyyy") : ""} · {n(balanceOf(p))} left of {n(p.quantity)}
                                </div>
                              </div>
                            </CommandItem>
                          ))
                        : positions.map((p) => (
                            <CommandItem key={p.id} value={`${p.part_code} ${p.name}`} disabled={!p.hasBom}
                                         onSelect={() => { if (p.hasBom) { pickSub(p.id); setPickerOpen(false); } }}>
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", p.id === itemId ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate"><span className="font-mono">{p.part_code}</span> {p.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  In store {n(p.inStore)} · being built {n(p.beingBuilt)}{p.toMake > 0 ? ` · to make ${n(p.toMake)}` : ""}
                                </div>
                              </div>
                              {!p.hasBom && <Badge variant="destructive" className="ml-2">No BOM</Badge>}
                            </CommandItem>
                          ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-qty">Quantity *</Label>
            <Input id="sched-qty" type="number" min={1} max={Number.isFinite(maxQty) ? maxQty : undefined}
                   value={quantity} onChange={(e) => { setQuantity(e.target.value); setChoices({}); }}
                   className={quantity && !qtyOk ? "border-destructive" : ""} />
            {projection && <p className="text-xs text-muted-foreground">Up to {n(maxQty)}</p>}
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

        {kind === "SA" && sub && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Built for</Label>
              <Select value={forOrder} onValueChange={setForOrder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STOCK}>Stock</SelectItem>
                  {parents.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.voucher_number} · {o.parts?.part_code} × {n(o.quantity)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground self-end pb-2">
              In store {n(sub.inStore)} · being built {n(sub.beingBuilt)} · held for vouchers {n(sub.held)}
            </div>
          </div>
        )}

        {kind === "FG" && projection && qty > 0 && subs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sub-assemblies on this product</h4>
            <div className="rounded-md border divide-y">
              {subs.map(({ pos, need }) => {
                const c = choiceFor(pos, need);
                const free = Math.max(0, pos.free);
                const short = Math.max(0, need - free);
                const others = [
                  ...pos.vouchers.map((v) => `${v.voucher_number} × ${n(v.quantity)} being built ${v.for_voucher ? `for ${v.for_voucher} (${v.for_product})` : "for stock"}`),
                  ...pos.holds.map((h) => `${n(h.quantity)} held for ${h.voucher_number} (${h.product_code})`),
                ];
                return (
                  <div key={pos.id} className="p-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                        <span className="font-mono">{pos.part_code}</span> <span className="truncate">{pos.name}</span>
                        {!pos.hasBom && <Badge variant="destructive">No BOM</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Needs <span className="font-semibold text-foreground">{n(need)}</span> · in store {n(pos.inStore)} ·
                        being built {n(pos.beingBuilt)} · held {n(pos.held)} · <span className="font-semibold text-foreground">free {n(free)}</span>
                      </div>
                      {others.length > 0 && <div className="text-xs text-muted-foreground">{others.join(" · ")}</div>}
                    </div>
                    <div className="space-y-2">
                      <RadioGroup value={c.mode} onValueChange={(v) => setChoice(pos, need, { mode: v as Choice["mode"] })}
                                  className="flex flex-wrap gap-x-5 gap-y-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <RadioGroupItem value="use" /> Use existing
                        </label>
                        <label className={cn("flex items-center gap-2 text-sm", pos.hasBom ? "cursor-pointer" : "opacity-60")}>
                          <RadioGroupItem value="new" disabled={!pos.hasBom} /> Issue new voucher
                        </label>
                      </RadioGroup>
                      {c.mode === "use" && short > 0 && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Short by {n(short)}: this kit cannot be issued until they are in store.
                        </p>
                      )}
                      {c.mode === "new" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" min={1} aria-label="Quantity to build" value={c.qty}
                                 onChange={(e) => setChoice(pos, need, { qty: e.target.value })} />
                          <DatePicker value={c.date} min={today()} onChange={(d) => setChoice(pos, need, { date: d })} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {kind === "SA" && sub && !sub.hasBom && (
          <p className="text-sm text-destructive">{sub.part_code} has no BOM yet. Add its bill of materials before scheduling it.</p>
        )}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit}>
            <Factory />
            {pending ? "Scheduling…" : newOnes.length && kind === "FG"
              ? `Schedule Production (${newOnes.length + 1} vouchers)` : "Schedule Production"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
