
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVendors = () => {
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      console.log("Debug: Fetching vendors...");
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
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
          throw uploadError;
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
          throw uploadError;
        }
        msmeCertificateUrl = fileName;
      }

      // Generate vendor code using VDR format
      console.log("Debug: Generating vendor code");
      const { data: lastVendor } = await supabase
        .from("vendors")
        .select("vendor_code")
        .like("vendor_code", "VDR%")
        .order("vendor_code", { ascending: false })
        .limit(1);

      let vendorCode = "VDR001";
      if (lastVendor && lastVendor.length > 0) {
        const lastCode = lastVendor[0].vendor_code;
        const numericPart = parseInt(lastCode.replace("VDR", "")) + 1;
        vendorCode = `VDR${numericPart.toString().padStart(3, "0")}`;
      }

      console.log("Debug: Generated vendor code:", vendorCode);

      // Prepare vendor data for insertion
      const insertData = {
        vendor_code: vendorCode,
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
      };

      console.log("Debug: Inserting vendor with data:", insertData);

      // Insert vendor
      const { data, error } = await supabase
        .from("vendors")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Debug: Vendor insertion error:", error);
        throw error;
      }

      console.log("Debug: Vendor created successfully:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor added successfully");
    },
    onError: (error: any) => {
      console.error("Error adding vendor:", error);
      toast.error(`Failed to add vendor: ${error.message || error}`);
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
