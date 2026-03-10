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
    rating_label_location_product: "",
    rating_label_location_box: "",
    mrp_label_location_box: "",
    brand_logo_location: "",
    compliance_notes: "",
    other_certifications: {} as Record<string, string>,
  });

  const existing = complianceList?.[0];

  useEffect(() => {
    if (existing) {
      setForm({
        bis_certificate_number: existing.bis_certificate_number || "",
        bis_expiry_date: existing.bis_expiry_date || "",
        compliance_status: existing.compliance_status || "Pending",
        notes: existing.notes || "",
        rating_label_location_product: (existing as any).rating_label_location_product || "",
        rating_label_location_box: (existing as any).rating_label_location_box || "",
        mrp_label_location_box: (existing as any).mrp_label_location_box || "",
        brand_logo_location: (existing as any).brand_logo_location || "",
        compliance_notes: (existing as any).compliance_notes || "",
        other_certifications: (existing as any).other_certifications || {},
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
      bis_certificate_number: form.bis_certificate_number,
      bis_expiry_date: form.bis_expiry_date || null,
      compliance_status: form.compliance_status,
      notes: form.notes,
      rating_label_location_product: form.rating_label_location_product,
      rating_label_location_box: form.rating_label_location_box,
      mrp_label_location_box: form.mrp_label_location_box,
      brand_logo_location: form.brand_logo_location,
      compliance_notes: form.compliance_notes,
      other_certifications: form.other_certifications,
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

      {/* BIS Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">BIS Certification</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>BIS Certificate Number</Label>
            <Input value={form.bis_certificate_number} onChange={(e) => setForm({ ...form, bis_certificate_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>BIS Expiry Date</Label>
            <Input type="date" value={form.bis_expiry_date} onChange={(e) => setForm({ ...form, bis_expiry_date: e.target.value })} />
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
      </div>

      {/* Label Locations */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Label & Branding Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Rating Label Location (Product)</Label>
            <Input value={form.rating_label_location_product} onChange={(e) => setForm({ ...form, rating_label_location_product: e.target.value })} placeholder="e.g. Bottom panel" />
          </div>
          <div className="space-y-2">
            <Label>Rating Label Location (Box)</Label>
            <Input value={form.rating_label_location_box} onChange={(e) => setForm({ ...form, rating_label_location_box: e.target.value })} placeholder="e.g. Side panel" />
          </div>
          <div className="space-y-2">
            <Label>MRP Label Location (Box)</Label>
            <Input value={form.mrp_label_location_box} onChange={(e) => setForm({ ...form, mrp_label_location_box: e.target.value })} placeholder="e.g. Top flap" />
          </div>
          <div className="space-y-2">
            <Label>Brand Logo Location</Label>
            <Input value={form.brand_logo_location} onChange={(e) => setForm({ ...form, brand_logo_location: e.target.value })} placeholder="e.g. Front grille" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>General Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Compliance Notes</Label>
          <Textarea value={form.compliance_notes} onChange={(e) => setForm({ ...form, compliance_notes: e.target.value })} rows={3} placeholder="Additional compliance-specific notes..." />
        </div>
      </div>

      <Button onClick={handleSave} disabled={upsertCompliance.isPending}>
        {upsertCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Compliance
      </Button>
    </div>
  );
}
