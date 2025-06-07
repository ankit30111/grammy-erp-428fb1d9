import { useState } from "react";
import { toast } from "sonner";
import { useVendors } from "@/hooks/useVendors";

interface VendorFormData {
  name: string;
  contact_person_name: string;
  email: string;
  contact_number: string;
  address: string;
  gst_number: string;
  bank_account_number: string;
  ifsc_code: string;
  gst_certificate: File | null;
  msme_certificate: File | null;
}

const initialFormData: VendorFormData = {
  name: "",
  contact_person_name: "",
  email: "",
  contact_number: "",
  address: "",
  gst_number: "",
  bank_account_number: "",
  ifsc_code: "",
  gst_certificate: null,
  msme_certificate: null
};

export const useVendorForm = () => {
  const { addVendor, updateVendor } = useVendors();
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required field validation
    if (!formData.name.trim()) {
      errors.name = "Vendor name is required";
    }

    if (!formData.gst_number.trim()) {
      errors.gst_number = "GST number is required";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gst_number.trim())) {
      errors.gst_number = "Invalid GST number format";
    }

    // Email validation (if provided)
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Invalid email format";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    console.log("Debug: Starting vendor form submission");
    
    if (isSubmitting) {
      console.log("Debug: Form already submitting, ignoring duplicate request");
      return { success: false, error: "Form is already being submitted" };
    }

    if (!validateForm()) {
      console.log("Debug: Form validation failed:", validationErrors);
      toast.error("Please fix the validation errors before submitting");
      return { success: false, error: "Validation failed" };
    }

    setIsSubmitting(true);

    try {
      console.log("Debug: Form validation passed, preparing vendor data");

      // Prepare vendor data with proper null handling
      const vendorData = {
        name: formData.name.trim(),
        contact_person_name: formData.contact_person_name.trim() || undefined,
        email: formData.email.trim() || undefined,
        contact_number: formData.contact_number.trim() || undefined,
        address: formData.address.trim() || undefined,
        gst_number: formData.gst_number.trim(),
        bank_account_number: formData.bank_account_number.trim() || undefined,
        ifsc_code: formData.ifsc_code.trim() || undefined,
        gst_certificate: formData.gst_certificate || undefined,
        msme_certificate: formData.msme_certificate || undefined
      };

      console.log("Debug: Submitting vendor data (vendor_code will be auto-generated):", { ...vendorData, gst_certificate: vendorData.gst_certificate?.name, msme_certificate: vendorData.msme_certificate?.name });

      await addVendor.mutateAsync(vendorData);

      console.log("Debug: Vendor added successfully with auto-generated code");
      
      // Reset form on success
      setFormData(initialFormData);
      setValidationErrors({});
      
      return { success: true };
    } catch (error: any) {
      console.error("Debug: Error adding vendor:", error);
      
      let errorMessage = "Failed to add vendor";
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (vendorId: string) => {
    console.log("Debug: Starting vendor update for ID:", vendorId);
    
    if (isSubmitting) {
      console.log("Debug: Form already submitting, ignoring duplicate request");
      return { success: false, error: "Form is already being submitted" };
    }

    if (!validateForm()) {
      console.log("Debug: Form validation failed:", validationErrors);
      toast.error("Please fix the validation errors before submitting");
      return { success: false, error: "Validation failed" };
    }

    setIsSubmitting(true);

    try {
      console.log("Debug: Form validation passed, preparing vendor data for update");

      // Prepare vendor data with proper null handling
      const vendorData = {
        id: vendorId,
        name: formData.name.trim(),
        contact_person_name: formData.contact_person_name.trim() || undefined,
        email: formData.email.trim() || undefined,
        contact_number: formData.contact_number.trim() || undefined,
        address: formData.address.trim() || undefined,
        gst_number: formData.gst_number.trim(),
        bank_account_number: formData.bank_account_number.trim() || undefined,
        ifsc_code: formData.ifsc_code.trim() || undefined,
        gst_certificate: formData.gst_certificate || undefined,
        msme_certificate: formData.msme_certificate || undefined
      };

      console.log("Debug: Updating vendor data:", { ...vendorData, gst_certificate: vendorData.gst_certificate?.name, msme_certificate: vendorData.msme_certificate?.name });

      await updateVendor.mutateAsync(vendorData);

      console.log("Debug: Vendor updated successfully");
      toast.success("Vendor updated successfully");
      
      return { success: true };
    } catch (error: any) {
      console.error("Debug: Error updating vendor:", error);
      
      let errorMessage = "Failed to update vendor";
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setValidationErrors({});
  };

  const updateFormField = (field: keyof VendorFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return {
    formData,
    validationErrors,
    isSubmitting,
    handleSubmit,
    handleUpdate,
    resetForm,
    updateFormField,
    setFormData
  };
};
