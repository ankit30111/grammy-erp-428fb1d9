import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, Trash2, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { VendorDropdown } from "@/components/PPC/VendorDropdown";
import { RawMaterialDropdown } from "@/components/PPC/RawMaterialDropdown";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { supabase } from "@/integrations/supabase/client";
import { entryUnitsFor, fmtQty, toStockQty, type UnitPart } from "@/lib/units";
import { cn } from "@/lib/utils";

const db = supabase as any;
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type PartInfo = UnitPart & { id: string; part_code: string; name: string };
interface Line {
  key: string;
  id?: string;                       // saved line; none for a new one
  poi?: string | null;               // PO line it receives against
  part: PartInfo;
  unit: string;                      // unit the quantity is typed in
  qty: string;                       // quantity in that unit
  locked: boolean;                   // inspected by IQC
  iqc: string;
  removed?: boolean;
}

/** "Invoice Number: INV-12 (Non-PO GRN)" was how older GRNs kept the invoice. */
const OLD_INVOICE = /Invoice Number:\s*([^\s(]+)\s*(\(Non-PO GRN\))?/i;

const stockUnit = (p: UnitPart) => (p.uom || "PCS").toUpperCase();

/**
 * Edit a saved GRN. The header can always change; a line can change (quantity,
 * unit, removed, new ones added) while it is waiting for IQC. Stock in
 * quarantine follows every change (grn_edit in the database).
 */
export function GRNEditDialog({ grn, onClose }: { grn: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { rawMaterials } = useRawMaterials();
  const isPO = !!grn.purchase_order_id;
  const oldInvoice = grn.notes?.match(OLD_INVOICE);

  const [vendorId, setVendorId] = useState<string>(grn.vendor_id ?? "");
  const [invoice, setInvoice] = useState<string>(grn.invoice_number ?? oldInvoice?.[1] ?? "");
  const [invoiceDate, setInvoiceDate] = useState<string>(grn.invoice_date ?? "");
  const [receivedDate, setReceivedDate] = useState<string>(grn.received_date ?? "");
  const [notes, setNotes] = useState<string>((grn.notes ?? "").replace(OLD_INVOICE, "").trim());
  const [lines, setLines] = useState<Line[]>(() =>
    (grn.grn_items ?? []).map((i: any) => {
      const part = i.parts as PartInfo;
      const inOther = !!i.received_uom && i.received_in_uom != null;
      return {
        key: i.id, id: i.id, poi: i.purchase_order_item_id, part,
        unit: inOther ? i.received_uom : stockUnit(part),
        qty: String(inOther ? i.received_in_uom : i.received_quantity),
        locked: (i.iqc_outcome && i.iqc_outcome !== "PENDING") || !!i.store_confirmed_at,
        iqc: i.iqc_outcome ?? "PENDING",
      };
    }));
  const [add, setAdd] = useState<{ part: string; poi: string; unit: string; qty: string }>({ part: "", poi: "", unit: "", qty: "" });
  const [saving, setSaving] = useState(false);

  // the PO's lines, for adding a missed one to a PO GRN
  const { data: poItems = [] } = useQuery({
    queryKey: ["grn-edit-po-items", grn.purchase_order_id],
    enabled: isPO,
    queryFn: async () => {
      const { data, error } = await db.from("purchase_order_items")
        .select("id, quantity, received_quantity, parts(id, part_code, name, uom, purchase_uom, purchase_factor)")
        .eq("purchase_order_id", grn.purchase_order_id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const onGrn = new Set(lines.filter((l) => !l.removed).map((l) => (isPO ? l.poi : l.part.id)));
  const addPart: PartInfo | undefined = isPO
    ? poItems.find((p: any) => p.id === add.poi)?.parts
    : (rawMaterials.find((m: any) => m.id === add.part) as any);

  const stockOf = (l: { qty: string; unit: string; part: UnitPart }) => toStockQty(Number(l.qty) || 0, l.unit, l.part);
  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    if (!addPart) return toast.error(isPO ? "Choose the PO line" : "Choose the part");
    if (!(Number(add.qty) > 0)) return toast.error("Enter the received quantity");
    setLines((ls) => [...ls, {
      key: `new-${Date.now()}`, poi: isPO ? add.poi : null, part: addPart,
      unit: add.unit || stockUnit(addPart), qty: add.qty, locked: false, iqc: "PENDING",
    }]);
    setAdd({ part: "", poi: "", unit: "", qty: "" });
  };

  const live = lines.filter((l) => !l.removed);
  const save = async () => {
    if (!isPO && !vendorId) return toast.error("Choose the vendor");
    if (!invoice.trim()) return toast.error("Enter the invoice number");
    if (!live.length) return toast.error("A GRN needs at least one line. To drop the whole GRN, delete it.");
    const bad = live.find((l) => !l.locked && !(Number(l.qty) > 0));
    if (bad) return toast.error(`Enter a quantity for ${bad.part.part_code}, or remove the line`);
    const payload = live.map((l) => {
      const inStockUnit = l.unit.toUpperCase() === stockUnit(l.part);
      return {
        id: l.id ?? null, part_id: l.part.id, purchase_order_item_id: l.poi ?? null,
        received_quantity: stockOf(l),
        received_uom: inStockUnit ? null : l.unit,
        received_in_uom: inStockUnit ? null : Number(l.qty),
      };
    });
    setSaving(true);
    const { error } = await db.rpc("grn_edit", {
      p_grn: grn.id,
      p_header: {
        ...(isPO ? {} : { vendor_id: vendorId }),
        invoice_number: invoice, invoice_date: invoiceDate || null, received_date: receivedDate, notes,
      },
      p_lines: payload,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${grn.grn_number} updated`);
    qc.invalidateQueries({ queryKey: ["grn"] });
    qc.invalidateQueries({ predicate: (q) => /stock|inventory|iqc|purchase/i.test(String(q.queryKey[0] ?? "")) });
    onClose();
  };

  const unitPicker = (part: UnitPart | undefined, value: string, onChange: (u: string) => void, disabled?: boolean) => (
    <select className={sel} aria-label="Unit" value={value || (part ? stockUnit(part) : "")} disabled={disabled || !part}
            onChange={(e) => onChange(e.target.value)}>
      {(part ? entryUnitsFor(part) : []).map((u) => <option key={u.unit} value={u.unit}>{u.unit}{u.hint ? ` (${u.hint})` : ""}</option>)}
    </select>
  );

  const pendingCount = lines.filter((l) => !l.locked).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1000px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {grn.grn_number}</DialogTitle>
          <DialogDescription>
            {isPO ? <>Against PO <span className="font-mono">{grn.purchase_orders?.po_number}</span>. </> : "Without a PO. "}
            Lines can change while they wait for IQC; quarantine stock follows the change.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Vendor</Label>
            {isPO ? <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">{grn.vendors?.name ?? "—"} <span className="ml-2 text-xs text-muted-foreground">(from the PO)</span></div>
              : <VendorDropdown value={vendorId} onValueChange={setVendorId} />}
          </div>
          <div className="space-y-1"><Label htmlFor="ge-inv">Invoice number</Label>
            <Input id="ge-inv" value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ge-invd">Invoice date</Label>
            <Input id="ge-invd" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ge-rd">Received date</Label>
            <Input id="ge-rd" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3"><Label htmlFor="ge-notes">Notes</Label>
            <Textarea id="ge-notes" rows={1} className="min-h-10" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead className="w-32">Received</TableHead>
                <TableHead className="w-48">Unit</TableHead>
                <TableHead className="w-32 text-right">Into stock</TableHead>
                <TableHead className="w-28">IQC</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.key} className={cn(l.removed && "opacity-50", !l.id && "bg-primary/5")}>
                  <TableCell className={cn("text-sm", l.removed && "line-through")}>
                    <span className="font-mono">{l.part.part_code}</span> {l.part.name}
                    {!l.id && <Badge variant="outline" className="ml-2">new</Badge>}
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="any" className="h-9" aria-label={`Received ${l.part.part_code}`}
                           value={l.qty} disabled={l.locked || l.removed} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                  </TableCell>
                  <TableCell>{unitPicker(l.part, l.unit, (unit) => setLine(l.key, { unit }), l.locked || l.removed)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmtQty(stockOf(l))} {stockUnit(l.part)}</TableCell>
                  <TableCell className="text-sm">
                    {l.locked ? <span className="inline-flex items-center gap-1 text-muted-foreground" title="IQC has inspected this line; its stock has moved on"><Lock className="h-3.5 w-3.5" /> {l.iqc.toLowerCase()}</span>
                      : <span className="text-muted-foreground">waiting</span>}
                  </TableCell>
                  <TableCell>
                    {!l.locked && (l.removed
                      ? <Button variant="ghost" size="icon" title="Keep this line" onClick={() => setLine(l.key, { removed: false })}><Undo2 className="h-4 w-4" /></Button>
                      : <Button variant="ghost" size="icon" title="Remove this line" className="text-muted-foreground hover:text-destructive"
                                onClick={() => (l.id ? setLine(l.key, { removed: true }) : setLines((ls) => ls.filter((x) => x.key !== l.key)))}><Trash2 className="h-4 w-4" /></Button>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[minmax(0,1fr)_8rem_12rem_auto] sm:items-end">
          <div className="space-y-1 min-w-0">
            <Label>{isPO ? "Add a line of the PO" : "Add a part"}</Label>
            {isPO ? (
              <select className={cn(sel, "h-10")} value={add.poi} onChange={(e) => setAdd({ ...add, poi: e.target.value, unit: "" })}>
                <option value="">{poItems.some((p: any) => !onGrn.has(p.id)) ? "Choose…" : "Every PO line is on this GRN"}</option>
                {poItems.filter((p: any) => !onGrn.has(p.id)).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.parts?.part_code} · {p.parts?.name} (ordered {fmtQty(Number(p.quantity))}, received {fmtQty(Number(p.received_quantity ?? 0))})</option>
                ))}
              </select>
            ) : (
              <RawMaterialDropdown value={add.part} onValueChange={(v) => setAdd({ ...add, part: v, unit: "" })}
                                   excludeIds={[...onGrn] as string[]} placeholder="Choose part" />
            )}
          </div>
          <div className="space-y-1"><Label htmlFor="ge-addq">Received</Label>
            <Input id="ge-addq" type="number" min="0" step="any" value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value })} /></div>
          <div className="space-y-1"><Label>Unit</Label>{unitPicker(addPart, add.unit, (unit) => setAdd({ ...add, unit }))}</div>
          <Button variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Add line</Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {pendingCount < lines.length ? `${lines.length - pendingCount} line(s) inspected by IQC stay as they are. ` : ""}
            Removing a line or lowering a quantity takes that stock back out of quarantine.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
