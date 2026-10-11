import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBomTree, type BomTreeNode } from "@/hooks/useBOM";
import { RECEIPT_TYPES, type ReceiptType, useComplaintMutations } from "@/hooks/useComplaints";
import { usePlantId } from "@/hooks/usePlantId";
import { cn } from "@/lib/utils";

const db = supabase as any;
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

interface Line { key: number; part_id: string; faulty_part_id: string; quantity: string; symptom: string; serial_numbers: string }
const blank = (key: number): Line => ({ key, part_id: "", faulty_part_id: "", quantity: "1", symptom: "", serial_numbers: "" });

/** Every part in a BOM, sub-assemblies opened, once each. */
export const flattenBom = (nodes: BomTreeNode[], out = new Map<string, BomTreeNode>()) => {
  for (const n of nodes) { if (!out.has(n.part_id)) out.set(n.part_id, n); flattenBom(n.children, out); }
  return [...out.values()];
};

function FaultyPartPicker({ productId, value, onChange }: { productId: string; value: string; onChange: (v: string) => void }) {
  const { tree, isLoading } = useBomTree(productId || undefined);
  const parts = useMemo(() => flattenBom(tree).sort((a, b) => a.part_code.localeCompare(b.part_code, "en", { numeric: true })), [tree]);
  return (
    <select className={sel} value={value} disabled={!productId} onChange={(e) => onChange(e.target.value)}>
      <option value="">{!productId ? "Choose the product first" : isLoading ? "Loading BOM…" : parts.length ? "Faulty part…" : "No BOM for this product"}</option>
      {parts.map((p) => <option key={p.part_id} value={p.part_id}>{p.part_code} · {p.name}</option>)}
    </select>
  );
}

/**
 * Receiving complaints: one product or a batch from one customer. Each unit
 * becomes its own complaint (CC-…), analysed and closed on its own.
 */
export function ComplaintReceiptForm() {
  const plantId = usePlantId();
  const { createReceipt } = useComplaintMutations();
  const [head, setHead] = useState({ customer_id: "", receipt_type: "COMPLETE_PRODUCTS" as ReceiptType, customer_reference: "", receipt_date: today(), purchase_date: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([blank(1)]);

  const { data: customers = [] } = useQuery({
    queryKey: ["complaint-customers"],
    queryFn: async () => {
      const { data, error } = await db.from("customers").select("id, name, customer_code, customer_brands ( brand )").eq("is_active", true).order("customer_code");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["complaint-products"],
    queryFn: async () => {
      const { data, error } = await db.from("parts").select("id, part_code, name, brand, source_type")
        .in("source_type", ["FINISHED_GOOD", "MODEL"]).eq("is_active", true).order("part_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // The customer's own brand codes first.
  const customer = customers.find((c: any) => c.id === head.customer_id);
  const theirBrands = new Set<string>((customer?.customer_brands ?? []).map((b: any) => b.brand));
  const ordered = useMemo(() => [...products].sort((a: any, b: any) =>
    Number(theirBrands.has(b.brand)) - Number(theirBrands.has(a.brand)) || a.part_code.localeCompare(b.part_code, "en", { numeric: true })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [products, head.customer_id, customers]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0);
  const partsOnly = head.receipt_type === "FAULTY_PARTS_ONLY";

  const problems: string[] = [];
  if (!head.customer_id) problems.push("Choose the customer");
  lines.forEach((l, i) => {
    if (!l.part_id) problems.push(`Line ${i + 1}: choose the product`);
    if (!(Number(l.quantity) >= 1)) problems.push(`Line ${i + 1}: quantity`);
    if (partsOnly && !l.faulty_part_id) problems.push(`Line ${i + 1}: choose the faulty part`);
    const serials = l.serial_numbers.split(/[,;\s]+/).filter(Boolean);
    if (serials.length > (Number(l.quantity) || 0)) problems.push(`Line ${i + 1}: more serial numbers than units`);
  });

  const save = () => {
    if (problems.length) return toast.error(problems[0]);
    createReceipt.mutate(
      {
        receipt: { ...head, plant_id: plantId ?? "" },
        items: lines.map((l) => ({ part_id: l.part_id, faulty_part_id: partsOnly ? l.faulty_part_id : "", quantity: Number(l.quantity), symptom: l.symptom, serial_numbers: l.serial_numbers })),
      },
      { onSuccess: () => { setLines([blank(Date.now())]); setHead((h) => ({ ...h, customer_reference: "", purchase_date: "", notes: "" })); } },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Receive complaint</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label>Customer *</Label>
            <select className={sel} value={head.customer_id} onChange={(e) => setHead({ ...head, customer_id: e.target.value })}>
              <option value="">Choose…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.customer_code} · {c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Bill / DC / ref. no.</Label>
            <Input value={head.customer_reference} onChange={(e) => setHead({ ...head, customer_reference: e.target.value })} placeholder="Customer's document" />
          </div>
          <div className="space-y-1">
            <Label>Received on *</Label>
            <Input type="date" value={head.receipt_date} max={today()} onChange={(e) => setHead({ ...head, receipt_date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Purchase date</Label>
            <Input type="date" value={head.purchase_date} max={head.receipt_date} onChange={(e) => setHead({ ...head, purchase_date: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>What was received</Label>
          <div className="flex flex-wrap gap-2">
            {RECEIPT_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setHead({ ...head, receipt_type: t.value })}
                      className={cn("rounded-md border px-3 py-1.5 text-left text-sm", head.receipt_type === t.value ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.3fr)_5rem_minmax(0,1.4fr)_minmax(0,1fr)_2.25rem]"
               style={partsOnly ? { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) 5rem minmax(0,1.2fr) minmax(0,1fr) 2.25rem" } : undefined}>
            <span>Product *</span>{partsOnly && <span>Faulty part *</span>}<span>Qty *</span><span>Customer's complaint</span><span>Serial numbers</span><span />
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid gap-2 rounded-md border p-2 lg:items-start lg:rounded-none lg:border-0 lg:p-0 lg:grid-cols-[minmax(0,1.3fr)_5rem_minmax(0,1.4fr)_minmax(0,1fr)_2.25rem]"
                 style={partsOnly ? { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) 5rem minmax(0,1.2fr) minmax(0,1fr) 2.25rem" } : undefined}>
              <select className={sel} value={l.part_id} onChange={(e) => setLine(l.key, { part_id: e.target.value, faulty_part_id: "" })}>
                <option value="">Product…</option>
                {ordered.map((p: any) => <option key={p.id} value={p.id}>{p.part_code} · {p.name}</option>)}
              </select>
              {partsOnly && <FaultyPartPicker productId={l.part_id} value={l.faulty_part_id} onChange={(v) => setLine(l.key, { faulty_part_id: v })} />}
              <Input type="number" min={1} max={1000} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
              <Input value={l.symptom} onChange={(e) => setLine(l.key, { symptom: e.target.value })} placeholder="No sound, BT not pairing…" />
              <Input value={l.serial_numbers} onChange={(e) => setLine(l.key, { serial_numbers: e.target.value })} placeholder="Optional, comma separated" />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank(Date.now())])}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        </div>

        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea rows={2} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} placeholder="Condition of the package, accessories received…" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {total > 0 ? `${total} complaint${total === 1 ? "" : "s"} will be opened, one per unit` : ""}
          </span>
          <Button onClick={save} disabled={createReceipt.isPending}>{createReceipt.isPending ? "Saving…" : "Save receipt"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
