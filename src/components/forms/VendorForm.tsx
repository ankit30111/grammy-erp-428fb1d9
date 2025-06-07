
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, AlertCircle } from "lucide-react";
import { useVendorForm } from "@/hooks/useVendorForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VendorFormProps {
  onSuccess?: () => void;
  editingVendor?: any;
  onCancel?: () => void;
}

export const VendorForm = ({ onSuccess, editingVendor, onCancel }: VendorFormProps) => {
  const {
    formData,
    validationErrors,
    isSubmitting,
    handleSubmit,
    handleUpdate,
    updateFormField,
    setFormData
  } = useVendorForm();

  // Initialize form with editing data
  React.useEffect(() => {
    if (editingVendor) {
      setFormData({
        name: editingVendor.name || "",
        contact_person_name: editingVendor.contact_person_name || "",
        email: editingVendor.email || "",
        contact_number: editingVendor.contact_number || "",
        address: editingVendor.address || "",
        gst_number: editingVendor.gst_number || "",
        bank_account_number: editingVendor.bank_account_number || "",
        ifsc_code: editingVendor.ifsc_code || "",
        gst_certificate: null,
        msme_certificate: null
      });
    }
  }, [editingVendor, setFormData]);

  const onSubmit = async () => {
    let result;
    if (editingVendor) {
      result = await handleUpdate(editingVendor.id);
    } else {
      result = await handleSubmit();
    }
    
    if (result.success && onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="grid gap-6 py-4">
      {/* Show validation errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please fix the following errors:
            <ul className="mt-2 list-disc list-inside">
              {Object.values(validationErrors).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Vendor Name *</Label>
          <Input 
            id="name" 
            value={formData.name} 
            onChange={(e) => updateFormField('name', e.target.value)}
            placeholder="Enter vendor name"
            className={validationErrors.name ? "border-destructive" : ""}
          />
          {validationErrors.name && (
            <p className="text-sm text-destructive">{validationErrors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_person">Contact Person Name</Label>
          <Input 
            id="contact_person" 
            value={formData.contact_person_name} 
            onChange={(e) => updateFormField('contact_person_name', e.target.value)}
            placeholder="Enter contact person name"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact">Contact Number</Label>
          <Input 
            id="contact" 
            value={formData.contact_number} 
            onChange={(e) => updateFormField('contact_number', e.target.value)}
            placeholder="+91-9876543210"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Contact Email ID</Label>
          <Input 
            id="email" 
            type="email"
            value={formData.email} 
            onChange={(e) => updateFormField('email', e.target.value)}
            placeholder="vendor@example.com"
            className={validationErrors.email ? "border-destructive" : ""}
          />
          {validationErrors.email && (
            <p className="text-sm text-destructive">{validationErrors.email}</p>
          )}
        </div>
      </div>

      {/* GST and Address */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gst">GST Number *</Label>
          <Input 
            id="gst" 
            value={formData.gst_number} 
            onChange={(e) => updateFormField('gst_number', e.target.value)}
            placeholder="27ABCDE1234F1Z5"
            className={validationErrors.gst_number ? "border-destructive" : ""}
          />
          {validationErrors.gst_number && (
            <p className="text-sm text-destructive">{validationErrors.gst_number}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea 
            id="address" 
            value={formData.address} 
            onChange={(e) => updateFormField('address', e.target.value)}
            placeholder="Enter complete address"
            rows={2}
          />
        </div>
      </div>

      {/* Banking Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account">Bank Account Number</Label>
          <Input 
            id="account" 
            value={formData.bank_account_number} 
            onChange={(e) => updateFormField('bank_account_number', e.target.value)}
            placeholder="1234567890"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ifsc">IFSC Code</Label>
          <Input 
            id="ifsc" 
            value={formData.ifsc_code} 
            onChange={(e) => updateFormField('ifsc_code', e.target.value)}
            placeholder="HDFC0001234"
          />
        </div>
      </div>

      {/* Document Uploads */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gst_cert">GST Certificate (PDF)</Label>
          <div className="flex items-center space-x-2">
            <Input 
              id="gst_cert" 
              type="file"
              accept=".pdf"
              onChange={(e) => updateFormField('gst_certificate', e.target.files?.[0] || null)}
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="msme_cert">MSME/UDYAM Certificate (PDF)</Label>
          <div className="flex items-center space-x-2">
            <Input 
              id="msme_cert" 
              type="file"
              accept=".pdf"
              onChange={(e) => updateFormField('msme_certificate', e.target.files?.[0] || null)}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button 
          type="button" 
          onClick={onSubmit}
          disabled={isSubmitting || !formData.name.trim() || !formData.gst_number.trim()}
        >
          {isSubmitting ? (editingVendor ? "Updating..." : "Adding...") : (editingVendor ? "Update Vendor" : "Add Vendor")}
        </Button>
      </div>
    </div>
  );
};
