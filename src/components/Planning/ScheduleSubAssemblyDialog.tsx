import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { useCreateStockBuild } from "@/hooks/useProductionSchedules";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { CLOSED_VOUCHER_STATES, type SubAssemblyPosition } from "@/hooks/useSubAssemblyPositions";

const STOCK = "__stock__";
const n = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 3 });

/**
 * Issue a voucher for one sub-assembly: for stock, or for a finished-good
 * voucher that uses it. Opened from a row of the Sub-assemblies tab.
 */
export const ScheduleSubAssemblyDialog = ({
  part, open, onOpenChange,
}: { part: SubAssemblyPosition | null; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const plantId = usePlantId();
  const { rows: lines } = useProductionLinesList();
  const create = useCreateStockBuild();
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState("");
  const [lineId, setLineId] = useState("");
  const [forOrder, setForOrder] = useState(STOCK);

  useEffect(() => {
    if (!open || !part) return;
    setQuantity(part.toMake > 0 ? String(part.toMake) : "");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setLineId("");
    setForOrder(STOCK);
  }, [open, part?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open finished-good vouchers that use this sub-assembly.
  const usedInIds = part?.usedIn.map((u) => u.id) ?? [];
  const { data: parents = [] } = useQuery({
    queryKey: ["fg-vouchers-using", part?.id, plantId],
    enabled: open && !!plantId && usedInIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("production_orders")
        .select("id, voucher_number, quantity, planned_date, parts!part_id ( part_code )")
        .eq("plant_id", plantId)
        .in("part_id", usedInIds)
        .not("status", "in", `(${CLOSED_VOUCHER_STATES.join(",")})`)
        .order("planned_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sub-assembly lines first; any line can still be chosen.
  const sortedLines = [...lines].sort((a, b) =>
    Number(b.line_type?.toUpperCase() === "SUB_ASSEMBLY") - Number(a.line_type?.toUpperCase() === "SUB_ASSEMBLY"));

  const ok = !!part?.hasBom && Number(quantity) > 0 && !!date;
  const submit = async () => {
    if (!ok || !part) return;
    await create.mutateAsync({
      part_id: part.id,
      quantity: Number(quantity),
      scheduled_date: date,
      production_line_id: lineId || null,
      parent_order_id: forOrder === STOCK ? null : forOrder,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Sub-assembly</DialogTitle>
        </DialogHeader>
        {part && (
          <div className="space-y-4 py-1">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium"><span className="font-mono">{part.part_code}</span> · {part.name}</div>
              <div className="text-muted-foreground">
                In store {n(part.inStore)} · being built {n(part.beingBuilt)} · held {n(part.held)} · to make {n(part.toMake)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-qty">Quantity *</Label>
                <Input id="sa-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Production date *</Label>
                <DatePicker value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={setDate} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Production line</Label>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent>
                    {sortedLines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Built for</Label>
                <Select value={forOrder} onValueChange={setForOrder}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STOCK}>Stock</SelectItem>
                    {parents.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.voucher_number} · {o.parts?.part_code} × {n(Number(o.quantity))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!part.hasBom && (
              <p className="text-sm text-destructive">{part.part_code} has no BOM yet. Add its bill of materials before scheduling it.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!ok || create.isPending}>
            {create.isPending ? "Scheduling…" : "Schedule and issue voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
