import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrammyProducts } from "@/hooks/useDashProducts";

const categories = [
  "Party Speaker", "Tower Speaker", "Soundbar", "Portable Speaker",
  "Accessories", "Multimedia Speaker", "Home Theatre", "Subwoofer", "Other",
];

const statuses = ["Development", "Ready for Production", "Active", "Discontinued"];

interface ProductBasicInfoTabProps {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  isEditing: boolean;
}

export default function ProductBasicInfoTab({ form, setForm, isEditing }: ProductBasicInfoTabProps) {
  const { data: grammyProducts } = useGrammyProducts();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label>Product Name *</Label>
        <Input value={form.product_name || ""} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Model Number *</Label>
        <Select value={form.model_number || ""} onValueChange={(v) => setForm({ ...form, model_number: v })}>
          <SelectTrigger><SelectValue placeholder="Select model..." /></SelectTrigger>
          <SelectContent>
            {grammyProducts?.map((p: any) => (
              <SelectItem key={p.id} value={p.product_code || p.name}>
                {p.product_code} — {p.name}
              </SelectItem>
            ))}
            <SelectItem value="__new__">+ Create New Model</SelectItem>
          </SelectContent>
        </Select>
        {form.model_number === "__new__" && (
          <Input
            placeholder="Enter new model number..."
            value={form.new_model_number || ""}
            onChange={(e) => setForm({ ...form, new_model_number: e.target.value })}
            className="mt-2"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={form.category || "Other"} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>HSN Code</Label>
        <Input value={form.hsn_code || ""} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>EAN / Barcode</Label>
        <Input value={form.barcode_ean || ""} onChange={(e) => setForm({ ...form, barcode_ean: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>MRP (₹)</Label>
        <Input type="number" value={form.mrp || 0} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} />
      </div>

      <div className="space-y-2">
        <Label>Serial No. Prefix</Label>
        <Input value={form.serial_prefix || ""} onChange={(e) => setForm({ ...form, serial_prefix: e.target.value })} placeholder="e.g. DASH-SPK" />
      </div>

      <div className="space-y-2">
        <Label>Next Serial Number</Label>
        <Input type="number" value={form.serial_next_number || 1} onChange={(e) => setForm({ ...form, serial_next_number: Number(e.target.value) })} />
        {form.serial_prefix && (
          <p className="text-xs text-muted-foreground">
            Next: {form.serial_prefix}-{String(form.serial_next_number || 1).padStart(5, "0")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Warranty (months)</Label>
        <Input type="number" value={form.warranty_period_months || 12} onChange={(e) => setForm({ ...form, warranty_period_months: Number(e.target.value) })} />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={form.status || "Development"} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-1 md:col-span-2 space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>
    </div>
  );
}
