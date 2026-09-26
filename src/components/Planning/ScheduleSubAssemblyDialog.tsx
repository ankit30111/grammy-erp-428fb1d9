import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useParts } from "@/hooks/useParts";
import { useCreateStockBuild } from "@/hooks/useProductionSchedules";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";

/**
 * Schedule a sub-assembly without a customer projection - built for stock.
 * Finished goods are not offered: they are scheduled from a projection.
 */
export const ScheduleSubAssemblyDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { parts } = useParts();
  const { rows: lines } = useProductionLinesList();
  const create = useCreateStockBuild();
  const [partId, setPartId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lineId, setLineId] = useState("");

  const subAssemblies = useMemo(
    () => (parts as any[])
      .filter((p) => p.source_type === "ASSEMBLED_STOCKED" && p.is_active !== false && p.approval_status !== "PENDING"
                     && p.approval_status !== "REJECTED")
      .sort((a, b) => a.part_code.localeCompare(b.part_code)),
    [parts],
  );
  const part = subAssemblies.find((p) => p.id === partId);

  const submit = async () => {
    if (!partId || !(Number(quantity) > 0) || !date) return;
    await create.mutateAsync({ part_id: partId, quantity: Number(quantity), scheduled_date: date, production_line_id: lineId || null });
    setPartId(""); setQuantity(""); setLineId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Sub-assembly</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Sub-assembly *</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between normal-case tracking-normal font-normal">
                  {part ? `${part.part_code} — ${part.name}` : "Choose a sub-assembly"}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search code or name..." />
                  <CommandList>
                    <CommandEmpty>No sub-assembly found.</CommandEmpty>
                    <CommandGroup>
                      {subAssemblies.map((p) => (
                        <CommandItem key={p.id} value={`${p.part_code} ${p.name}`}
                                     onSelect={() => { setPartId(p.id); setPickerOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", p.id === partId ? "opacity-100" : "opacity-0")} />
                          <span className="font-mono mr-2">{p.part_code}</span>{p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Production date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Production line</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
              <SelectContent>
                {lines.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!partId || !(Number(quantity) > 0) || !date || create.isPending}>
            {create.isPending ? "Scheduling…" : "Schedule and create voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
