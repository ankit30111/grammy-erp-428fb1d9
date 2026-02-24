import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDashProductCompliance, useDashProductComplianceMutations } from "@/hooks/useDashProducts";
import { AlertTriangle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { differenceInDays } from "date-fns";

interface ProductComplianceTabProps {
  productId: string | undefined;
}

export default function ProductComplianceTab({ productId }: ProductComplianceTabProps) {
  const { data: complianceList } = useDashProductCompliance(productId);
  const { upsertCompliance } = useDashProductComplianceMutations();
  const [form, setForm] = useState({
    bis_certificate_number: "",
    bis_expiry_date: "",
    compliance_status: "Pending",
    notes: "",
  });

  const existing = complianceList?.[0];

  useEffect(() => {
    if (existing) {
      setForm({
        bis_certificate_number: existing.bis_certificate_number || "",
        bis_expiry_date: existing.bis_expiry_date || "",
        compliance_status: existing.compliance_status || "Pending",
        notes: existing.notes || "",
      });
    }
  }, [existing]);

  if (!productId) {
    return <p className="text-muted-foreground text-center py-8">Save the product first to manage compliance.</p>;
  }

  const daysUntilExpiry = form.bis_expiry_date
    ? differenceInDays(new Date(form.bis_expiry_date), new Date())
    : null;

  const handleSave = () => {
    upsertCompliance.mutate({
      ...(existing ? { id: existing.id } : {}),
      product_id: productId,
      ...form,
    });
  };

  return (
    <div className="space-y-6">
      {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            BIS Certificate expires in {daysUntilExpiry} days! Renew immediately.
          </AlertDescription>
        </Alert>
      )}
      {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            BIS Certificate expired {Math.abs(daysUntilExpiry)} days ago.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>BIS Certificate Number</Label>
          <Input
            value={form.bis_certificate_number}
            onChange={(e) => setForm({ ...form, bis_certificate_number: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>BIS Expiry Date</Label>
          <Input
            type="date"
            value={form.bis_expiry_date}
            onChange={(e) => setForm({ ...form, bis_expiry_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Compliance Status</Label>
          <Select value={form.compliance_status} onValueChange={(v) => setForm({ ...form, compliance_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />
      </div>

      <Button onClick={handleSave} disabled={upsertCompliance.isPending}>
        {upsertCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Compliance
      </Button>
    </div>
  );
}
