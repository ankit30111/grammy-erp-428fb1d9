import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { type PlmProduct, usePlmMutations } from "@/hooks/usePLM";
import { usePartCategories } from "@/hooks/usePartCategories";
import { useNextModelCode } from "@/hooks/useModels";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
export const PLM_CATEGORIES = ["Party Speaker", "Soundbar", "Microphone", "Bluetooth Speaker", "PCB"];
/** Clients from the PLM tracker's list; the Customers master is added to these. */
const TRACKER_CLIENTS = ["Philips", "Croma", "Digimore", "LG", "Govo", "Ahuja", "AIWA", "Budweiser", "Byjus", "Clarion",
  "Divine", "Extras", "FlowBeats", "Flyball", "GEMCO", "Gizmore", "iBall", "Lapcare", "Oscar", "Portronics", "Sontrax",
  "Swiss Military", "Toreto"];

export const useClientNames = (products: PlmProduct[]) => {
  const { data: customers = [] } = useQuery({
    queryKey: ["plm-customer-names"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("customers").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const names = useMemo(() => [...new Set([...customers.map((c) => c.name), ...TRACKER_CLIENTS,
    ...products.map((p) => p.client).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b)), [customers, products]);
  return { names, customers };
};

const blank = {
  kind: "NEW_MODEL", based_on_id: "", based_on_part_id: "", product_code: "", name: "", category: "", client: "", ownership: "GRAMMY",
  business_model: "ODM", priority: "MEDIUM", start_date: new Date().toISOString().slice(0, 10), target_launch: "",
  target_cost: "", notes: "", copyTests: true,
};

/**
 * New product. A variation is an earlier product made for another customer (or
 * changed): it starts from the base product - category and target cost now,
 * tests on creation, and the BOM when its finished-good code is linked.
 */
export function NewProductDialog({ open, onOpenChange, products, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; products: PlmProduct[]; onCreated?: (code: string, variation: boolean) => void;
}) {
  const [f, setF] = useState({ ...blank });
  const { createProduct, copyTests } = usePlmMutations();
  const { names, customers } = useClientNames(products);
  useEffect(() => { if (open) setF({ ...blank }); }, [open]);
  const set = (patch: Partial<typeof blank>) => setF((x) => ({ ...x, ...patch }));
  const base = products.find((p) => p.id === f.based_on_id);
  // What the ERP already makes: models (master BOM) and brand codes (full BOM).
  const { data: erpProducts = [] } = useQuery({
    queryKey: ["plm-erp-base-products"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("parts")
        .select("id, part_code, name, category, source_type, model_id")
        .in("source_type", ["MODEL", "FINISHED_GOOD"]).eq("is_active", true).order("part_code");
      if (error) throw error;
      return (data ?? []) as { id: string; part_code: string; name: string; category: string; source_type: string; model_id: string | null }[];
    },
  });
  const erpBase = erpProducts.find((p) => p.id === f.based_on_part_id);
  // The product ID is the model number: category, then the next number of that
  // category (JA-016). It becomes the model in parts; brands go on it later.
  const { categories } = usePartCategories();
  const catPrefix = categories.find((c) => c.tier === "FINISHED" && c.name.toLowerCase() === f.category.trim().toLowerCase())?.prefix;
  const { data: nextCode } = useNextModelCode(open ? catPrefix : undefined);
  const [autoCode, setAutoCode] = useState(true);
  useEffect(() => { if (open) setAutoCode(true); }, [open]);
  useEffect(() => { if (autoCode && nextCode) setF((x) => ({ ...x, product_code: nextCode })); }, [nextCode, autoCode]);

  const pickBase = (value: string) => {
    const [src, id = ""] = value.split(":");
    if (src === "part") {
      const e = erpProducts.find((p) => p.id === id);
      const cat = categories.find((c) => c.prefix === e?.category)?.name;
      set({ based_on_part_id: id, based_on_id: "", ...(e ? { category: cat ?? f.category, name: f.name || e.name } : {}) });
      return;
    }
    const b = products.find((p) => p.id === id);
    set({ based_on_id: id, based_on_part_id: "", ...(b ? { category: b.category ?? "", target_cost: b.target_cost != null ? String(b.target_cost) : "",
      business_model: b.business_model ?? "ODM", name: f.name || b.name } : {}) });
  };

  const submit = async () => {
    if (!f.product_code.trim() || !f.name.trim()) return toast.error("Enter the product ID and name");
    if (f.kind === "VARIATION" && !f.based_on_id && !f.based_on_part_id) return toast.error("Choose the product this variation is based on");
    if (products.some((p) => p.product_code === f.product_code.trim().toUpperCase())) return toast.error(`${f.product_code.toUpperCase()} already exists`);
    const client = f.client.trim();
    const created = await createProduct.mutateAsync({
      product_code: f.product_code.trim(), name: f.name.trim(), kind: f.kind as any,
      based_on_id: f.kind === "VARIATION" && f.based_on_id ? f.based_on_id : null,
      based_on_part_id: f.kind === "VARIATION" && f.based_on_part_id ? f.based_on_part_id : null, category: f.category || null,
      client: client || null, customer_id: customers.find((c) => c.name === client)?.id ?? null,
      ownership: f.ownership as any, business_model: f.business_model as any, priority: f.priority as any,
      start_date: f.start_date || null, target_launch: f.target_launch || null,
      target_cost: f.target_cost ? Number(f.target_cost) : null, notes: f.notes || null,
    });
    if (f.kind === "VARIATION" && f.based_on_id && f.copyTests && created?.id) {
      await copyTests.mutateAsync({ from: f.based_on_id, to: created.id }).catch(() => undefined);
    }
    onOpenChange(false);
    if (created?.product_code) onCreated?.(created.product_code, f.kind === "VARIATION");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {[["NEW_MODEL", "New model"], ["VARIATION", "Based on an existing product"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="plm-kind" checked={f.kind === v} onChange={() => set({ kind: v })} /> {l}
              </label>
            ))}
          </div>
          {f.kind === "VARIATION" && (
            <div className="sm:col-span-2 space-y-2 rounded-md border bg-muted/40 p-3">
              <Label htmlFor="plm-base">Based on</Label>
              <select id="plm-base" className={sel}
                      value={f.based_on_part_id ? `part:${f.based_on_part_id}` : f.based_on_id ? `plm:${f.based_on_id}` : ""}
                      onChange={(e) => pickBase(e.target.value)}>
                <option value="">Choose the earlier product…</option>
                {erpProducts.length > 0 && (
                  <optgroup label="In production (ERP) - model = master BOM, brand code = full BOM">
                    {erpProducts.filter((x) => x.source_type === "MODEL").flatMap((m) => [
                      <option key={m.id} value={`part:${m.id}`}>{m.part_code} — {m.name} (model)</option>,
                      ...erpProducts.filter((b) => b.model_id === m.id).map((b) => (
                        <option key={b.id} value={`part:${b.id}`}>{"\u00a0\u00a0\u00a0"}{b.part_code} — {b.name}</option>
                      )),
                    ])}
                    {erpProducts.filter((b) => b.source_type === "FINISHED_GOOD" && !b.model_id).map((b) => (
                      <option key={b.id} value={`part:${b.id}`}>{b.part_code} — {b.name}</option>
                    ))}
                  </optgroup>
                )}
                {products.length > 0 && (
                  <optgroup label="R&D projects">
                    {products.map((p) => <option key={p.id} value={`plm:${p.id}`}>{p.product_code} — {p.name}{p.client ? ` (${p.client})` : ""}</option>)}
                  </optgroup>
                )}
              </select>
              {erpBase && (
                <p className="text-xs text-muted-foreground">
                  After you create it, {erpBase.part_code}'s {erpBase.source_type === "MODEL" ? "master BOM" : "BOM (packaging included)"} opens
                  line by line: keep what stays, mark what changes. It is only read; {erpBase.part_code} itself does not change.
                </p>
              )}
              {base && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Category and target cost come from {base.product_code}. After you create it, {base.product_code}'s BOM opens
                    line by line: keep what stays, mark what changes for this product.
                  </p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={f.copyTests} onCheckedChange={(c) => set({ copyTests: Boolean(c) })} />
                    Copy {base.product_code}'s EVT / SVT test list (results start as pending)
                  </label>
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="plm-cat">Category</Label>
            <Input id="plm-cat" list="plm-cat-list" value={f.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="plm-cat-list">{[...new Set([...categories.filter((c) => c.tier === "FINISHED").map((c) => c.name), ...PLM_CATEGORIES])].map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-code">Product ID (model number)</Label>
            <Input id="plm-code" placeholder={catPrefix ? `${catPrefix}-…` : "Choose the category first"} value={f.product_code}
              onChange={(e) => { setAutoCode(false); set({ product_code: e.target.value.toUpperCase() }); }} />
            <p className="text-xs text-muted-foreground">
              {catPrefix ? "Given in order per category. Type over it only for a derived model like JA-06C." : "Party speakers, soundbars and mics get their number from the category."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-name">Product name</Label>
            <Input id="plm-name" placeholder="e.g. Philips TAX2304" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-client">Client (blank = Grammy's own)</Label>
            <Input id="plm-client" list="plm-client-list" value={f.client} onChange={(e) => set({ client: e.target.value })} />
            <datalist id="plm-client-list">{names.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-own">Design owned by</Label>
            <select id="plm-own" className={sel} value={f.ownership} onChange={(e) => set({ ownership: e.target.value })}>
              <option value="GRAMMY">Grammy</option><option value="CLIENT">Client</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-bm">Business model</Label>
            <select id="plm-bm" className={sel} value={f.business_model} onChange={(e) => set({ business_model: e.target.value })}>
              <option value="ODM">ODM</option><option value="OEM">OEM</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-pri">Priority</Label>
            <select id="plm-pri" className={sel} value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-cost">Target cost (₹ per unit)</Label>
            <Input id="plm-cost" type="number" min="0" step="any" value={f.target_cost} onChange={(e) => set({ target_cost: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-start">Start date</Label>
            <Input id="plm-start" type="date" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plm-launch">Target launch</Label>
            <Input id="plm-launch" type="date" value={f.target_launch} onChange={(e) => set({ target_launch: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="plm-notes">Remarks</Label>
            <Textarea id="plm-notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createProduct.isPending}>Create product</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
