import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomerFormData {
  name: string;
  /** Brand letters from the brands master (PH, AI ...). */
  brands: string[];
  contact_person_name: string;
  email: string;
  contact_number: string;
  address: string;
  gst_number: string;
  bank_account_number: string;
  ifsc_code: string;
  gst_certificate: File | null;
  msme_certificate: File | null;
  brand_authorization: File | null;
  /** Bank details were fetched for editing (admin only). */
  financeLoaded?: boolean;
}

const initialFormData: CustomerFormData = {
  name: "",
  brands: [],
  contact_person_name: "",
  email: "",
  contact_number: "",
  address: "",
  gst_number: "",
  bank_account_number: "",
  ifsc_code: "",
  gst_certificate: null,
  msme_certificate: null,
  brand_authorization: null
};

/** Trimmed text; a field the database left empty arrives as null. */
const t = (v: string | null | undefined) => (v ?? "").trim();

const setBrands = async (customerId: string, brands: string[]) => {
  const { error } = await supabase.rpc("customer_set_brands" as any, { p_customer: customerId, p_brands: brands });
  if (error) throw error;
};

export const useCustomerForm = () => {
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Only require Customer Name and GST Number
    if (!t(formData.name)) {
      errors.name = "Customer name is required";
    }

    if (!t(formData.gst_number)) {
      errors.gst_number = "GST number is required";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(t(formData.gst_number).toUpperCase())) {
      errors.gst_number = "Invalid GST number format";
    }

    // Email validation (only if provided)
    if (t(formData.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t(formData.email))) {
      errors.email = "Invalid email format";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateCustomerCode = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_code')
      .order('customer_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error generating customer code:', error);
      return 'CUST001';
    }

    if (!data || data.length === 0) {
      return 'CUST001';
    }

    const lastCode = data[0].customer_code;
    const numericPart = parseInt(lastCode.replace('CUST', '')) + 1;
    return `CUST${numericPart.toString().padStart(3, '0')}`;
  };

  // Stores the raw bucket path so readers can mint short-lived signed URLs
  // via SignedStorageLink. Required because customer-documents (and the four
  // other doc buckets being flipped in migration 003f) are private.
  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) {
      throw error;
    }

    return path;
  };

  const handleSubmit = async () => {
    
    if (isSubmitting) {
      return { success: false, error: "Form is already being submitted" };
    }

    if (!validateForm()) {
      toast.error("Please fix the validation errors before submitting");
      return { success: false, error: "Validation failed" };
    }

    setIsSubmitting(true);

    try {

      const customerCode = await generateCustomerCode();
      const customerData: any = {
        customer_code: customerCode,
        name: t(formData.name),
        contact_person_name: t(formData.contact_person_name) || null,
        email: t(formData.email) || null,
        contact_number: t(formData.contact_number) || null,
        address: t(formData.address) || null,
        gst_number: t(formData.gst_number).toUpperCase(),
        bank_account_number: t(formData.bank_account_number) || null,
        ifsc_code: t(formData.ifsc_code).toUpperCase() || null
      };

      // Upload files if provided
      if (formData.gst_certificate) {
        const gstPath = `${customerCode}/gst_certificate.pdf`;
        customerData.gst_certificate_url = await uploadFile(formData.gst_certificate, 'customer-documents', gstPath);
      }

      if (formData.msme_certificate) {
        const msmePath = `${customerCode}/msme_certificate.pdf`;
        customerData.msme_certificate_url = await uploadFile(formData.msme_certificate, 'customer-documents', msmePath);
      }

      if (formData.brand_authorization) {
        const brandPath = `${customerCode}/brand_authorization.pdf`;
        customerData.brand_authorization_url = await uploadFile(formData.brand_authorization, 'customer-documents', brandPath);
      }


      const { data: created, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select('id')
        .single();

      if (error) throw error;
      if (formData.brands.length) await setBrands(created.id, formData.brands);

      
      // Reset form on success
      setFormData(initialFormData);
      setValidationErrors({});
      
      toast.success(`Customer created successfully with code: ${customerCode}`);
      return { success: true };
    } catch (error: any) {
      console.error("Debug: Error creating customer:", error);
      
      let errorMessage = "Failed to create customer";
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (customerId: string) => {
    
    if (isSubmitting) {
      return { success: false, error: "Form is already being submitted" };
    }

    if (!validateForm()) {
      toast.error("Please fix the validation errors before submitting");
      return { success: false, error: "Validation failed" };
    }

    setIsSubmitting(true);

    try {

      const customerData: any = {
        name: t(formData.name),
        contact_person_name: t(formData.contact_person_name) || null,
        email: t(formData.email) || null,
        contact_number: t(formData.contact_number) || null,
        address: t(formData.address) || null,
        gst_number: t(formData.gst_number).toUpperCase(),
        bank_account_number: t(formData.bank_account_number) || null,
        ifsc_code: t(formData.ifsc_code).toUpperCase() || null
      };

      // Upload new files if provided (would need customer_code for path)
      // This would require fetching the customer first to get the customer_code
      // For now, keeping it simple and not handling file updates


      // Bank details are only sent when they were loaded (admin); a blank
      // field from someone who cannot see them must not wipe them.
      if (!formData.financeLoaded) {
        delete customerData.bank_account_number;
        delete customerData.ifsc_code;
      }

      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', customerId);

      if (error) throw error;
      await setBrands(customerId, formData.brands);

      toast.success("Customer updated successfully");
      
      return { success: true };
    } catch (error: any) {
      console.error("Debug: Error updating customer:", error);
      
      let errorMessage = "Failed to update customer";
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

  const updateFormField = (field: keyof CustomerFormData, value: any) => {
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
