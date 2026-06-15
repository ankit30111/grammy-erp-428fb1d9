import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Safe columns only. Bank account number, IFSC and certificate URLs are
// admin-only (column-level grants); fetch them on demand via the
// get_vendor_finance(uuid) RPC from the edit dialog when the caller is admin.
const VENDOR_SAFE_COLS =
  "id, vendor_code, name, email, contact_number, address, gst_number, is_active, created_at, updated_at, created_by, contact_person_name";

export type VendorFinance = {
  id: string;
  bank_account_number: string | null;
  ifsc_code: string | null;
  gst_certificate_url: string | null;
  msme_certificate_url: string | null;
};

/**
 * Admin-only fetch for sensitive vendor finance fields (bank, IFSC,
 * certificate URLs). Backed by the get_vendor_finance(uuid) RPC, which
 * raises 42501 for non-admin callers.
 */
export const useVendorFinance = (vendorId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ["vendor-finance", vendorId],
    enabled: !!vendorId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_finance", {
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as VendorFinance | undefined;
    },
  });
};

export const useVendors = () => {
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      console.log("Debug: Fetching vendors...");
      
      const { data, error } = await supabase
        .from("vendors")
        .select(VENDOR_SAFE_COLS)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      console.log("Debug vendors data:", data);
      console.log("Debug vendors error:", error);
      
      if (error) {
        console.error("Error fetching vendors:", error);
        throw error;
      }
      return data || [];
    },
    retry: 3,
    retryDelay: 1000,
  });

  const addVendor = useMutation({
    mutationFn: async (vendorData: {
      name: string;
      contact_person_name?: string;
      email?: string;
      contact_number?: string;
      address?: string;
      gst_number: string;
      bank_account_number?: string;
      ifsc_code?: string;
      gst_certificate?: File;
      msme_certificate?: File;
    }) => {
      console.log("Debug: Starting vendor creation with data:", vendorData);
      
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;

      // Upload GST certificate if provided
      if (vendorData.gst_certificate) {
        console.log("Debug: Uploading GST certificate");
        const fileName = `gst_${Date.now()}_${vendorData.gst_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, vendorData.gst_certificate);
        
        if (uploadError) {
          console.error("Debug: GST certificate upload error:", uploadError);
          throw new Error(`Failed to upload GST certificate: ${uploadError.message}`);
        }
        gstCertificateUrl = fileName;
      }

      // Upload MSME certificate if provided
      if (vendorData.msme_certificate) {
        console.log("Debug: Uploading MSME certificate");
        const fileName = `msme_${Date.now()}_${vendorData.msme_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, vendorData.msme_certificate);
        
        if (uploadError) {
          console.error("Debug: MSME certificate upload error:", uploadError);
          throw new Error(`Failed to upload MSME certificate: ${uploadError.message}`);
        }
        msmeCertificateUrl = fileName;
      }

      // Prepare vendor data for insertion - database trigger will auto-generate vendor_code
      const insertData = {
        name: vendorData.name,
        contact_person_name: vendorData.contact_person_name || null,
        email: vendorData.email || null,
        contact_number: vendorData.contact_number || null,
        address: vendorData.address || null,
        gst_number: vendorData.gst_number,
        bank_account_number: vendorData.bank_account_number || null,
        ifsc_code: vendorData.ifsc_code || null,
        gst_certificate_url: gstCertificateUrl,
        msme_certificate_url: msmeCertificateUrl,
        vendor_code: '', // This will be overwritten by the database trigger
      };

      console.log("Debug: Inserting vendor with data:", insertData);

      // Insert vendor - database trigger will handle vendor_code generation
      const { data, error } = await supabase
        .from("vendors")
        .insert(insertData)
        .select(VENDOR_SAFE_COLS)
        .single();

      if (error) {
        console.error("Debug: Vendor insertion error:", error);
        
        // Enhanced error handling for specific cases
        if (error.code === '23505') {
          if (error.message.includes('vendors_gst_number_key')) {
            throw new Error('A vendor with this GST number already exists');
          }
          if (error.message.includes('vendors_vendor_code_key')) {
            throw new Error('Vendor code generation failed - please try again');
          }
          throw new Error('A vendor with these details already exists');
        }
        
        throw new Error(`Failed to create vendor: ${error.message}`);
      }

      console.log("Debug: Vendor created successfully with auto-generated code:", data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`Vendor added successfully with code: ${data.vendor_code}`);
    },
    onError: (error: any) => {
      console.error("Error adding vendor:", error);
      toast.error(error.message || "Failed to add vendor");
    },
  });

  const updateVendor = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      contact_person_name?: string;
      email?: string;
      contact_number?: string;
      address?: string;
      gst_number: string;
      bank_account_number?: string;
      ifsc_code?: string;
      gst_certificate?: File;
      msme_certificate?: File;
    }) => {
      console.log("Debug: Starting vendor update with data:", data);
      
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;

      // Upload new GST certificate if provided
      if (data.gst_certificate) {
        console.log("Debug: Uploading new GST certificate");
        const fileName = `gst_${Date.now()}_${data.gst_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, data.gst_certificate);
        
        if (uploadError) {
          console.error("Debug: GST certificate upload error:", uploadError);
          throw uploadError;
        }
        gstCertificateUrl = fileName;
      }

      // Upload new MSME certificate if provided
      if (data.msme_certificate) {
        console.log("Debug: Uploading new MSME certificate");
        const fileName = `msme_${Date.now()}_${data.msme_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, data.msme_certificate);
        
        if (uploadError) {
          console.error("Debug: MSME certificate upload error:", uploadError);
          throw uploadError;
        }
        msmeCertificateUrl = fileName;
      }

      const updateData: any = {
        name: data.name,
        contact_person_name: data.contact_person_name || null,
        email: data.email || null,
        contact_number: data.contact_number || null,
        address: data.address || null,
        gst_number: data.gst_number,
        bank_account_number: data.bank_account_number || null,
        ifsc_code: data.ifsc_code || null,
      };

      if (gstCertificateUrl) updateData.gst_certificate_url = gstCertificateUrl;
      if (msmeCertificateUrl) updateData.msme_certificate_url = msmeCertificateUrl;

      console.log("Debug: Updating vendor with data:", updateData);

      const { error } = await supabase
        .from("vendors")
        .update(updateData)
        .eq("id", data.id);

      if (error) {
        console.error("Debug: Vendor update error:", error);
        throw error;
      }

      console.log("Debug: Vendor updated successfully");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating vendor:", error);
      toast.error(`Failed to update vendor: ${error.message || error}`);
    },
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => {
      console.log("Debug: Deleting vendor with ID:", id);
      const { error } = await supabase
        .from("vendors")
        .update({ is_active: false })
        .eq("id", id);
      
      if (error) {
        console.error("Debug: Vendor deletion error:", error);
        throw error;
      }
      console.log("Debug: Vendor deleted successfully");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting vendor:", error);
      toast.error(`Failed to delete vendor: ${error.message || error}`);
    },
  });

  return {
    vendors,
    isLoading,
    addVendor,
    updateVendor,
    deleteVendor,
  };
};
