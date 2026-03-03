import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  form: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  customer?: any;
}

export function CustomerNotesTab({ form, onChange, customer }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={6}
          placeholder="Internal notes about this customer..."
        />
      </div>

      {customer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
          <div>
            <Label className="text-muted-foreground text-xs">Outstanding Balance</Label>
            <p className="font-semibold text-lg">₹{Number(customer.outstanding_balance || 0).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Credit Limit</Label>
            <p className="font-semibold text-lg">₹{Number(customer.credit_limit || 0).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Created At</Label>
            <p className="text-sm">{customer.created_at ? new Date(customer.created_at).toLocaleString() : "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Updated At</Label>
            <p className="text-sm">{customer.updated_at ? new Date(customer.updated_at).toLocaleString() : "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Created By</Label>
            <p className="text-sm">{customer.created_by || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Updated By</Label>
            <p className="text-sm">{customer.updated_by || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
