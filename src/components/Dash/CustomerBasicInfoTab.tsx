import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const customerTypes = ["Distributor", "Dealer", "Retailer", "Institutional"];

interface Props {
  form: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function CustomerBasicInfoTab({ form, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Customer Name *</Label>
        <Input value={form.customer_name || ""} onChange={(e) => onChange({ customer_name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Customer Type</Label>
        <Select value={form.customer_type || "Dealer"} onValueChange={(v) => onChange({ customer_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{customerTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Owner Name</Label>
        <Input value={form.owner_name || ""} onChange={(e) => onChange({ owner_name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Owner Phone</Label>
        <Input value={form.owner_phone || ""} onChange={(e) => onChange({ owner_phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Contact Person</Label>
        <Input value={form.contact_person || ""} onChange={(e) => onChange({ contact_person: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input value={form.phone || ""} onChange={(e) => onChange({ phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={form.email || ""} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Territory</Label>
        <Input value={form.territory || ""} onChange={(e) => onChange({ territory: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Salesman Name</Label>
        <Input value={form.salesman_name || ""} onChange={(e) => onChange({ salesman_name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Assigned Sales Manager</Label>
        <Input value={form.assigned_sales_manager || ""} onChange={(e) => onChange({ assigned_sales_manager: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Credit Limit (₹)</Label>
        <Input type="number" value={form.credit_limit || 0} onChange={(e) => onChange({ credit_limit: Number(e.target.value) })} />
      </div>
      <div className="flex items-center gap-3 pt-6">
        <Switch checked={form.is_active !== false} onCheckedChange={(v) => onChange({ is_active: v })} />
        <Label>Active Customer</Label>
      </div>
    </div>
  );
}
