import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  form: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function CustomerAddressTab({ form, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="col-span-full space-y-2">
        <Label>Primary / Registered Address</Label>
        <Textarea value={form.primary_address || ""} onChange={(e) => onChange({ primary_address: e.target.value })} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>City</Label>
        <Input value={form.city || ""} onChange={(e) => onChange({ city: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>State</Label>
        <Input value={form.state || ""} onChange={(e) => onChange({ state: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Pincode</Label>
        <Input value={form.pincode || ""} onChange={(e) => onChange({ pincode: e.target.value })} />
      </div>
      <div className="col-span-full space-y-2">
        <Label>Godown / Warehouse Address</Label>
        <Textarea value={form.godown_address || ""} onChange={(e) => onChange({ godown_address: e.target.value })} rows={3} />
      </div>
      <div className="col-span-full space-y-2">
        <Label>Address (Legacy)</Label>
        <Textarea value={form.address || ""} onChange={(e) => onChange({ address: e.target.value })} rows={2} />
      </div>
    </div>
  );
}
