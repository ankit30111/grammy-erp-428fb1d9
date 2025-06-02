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
        .order("created_at", { ascending: false });
      
      console.log("Debug vendors data:", data);
      console.log("Debug vendors error:", error);
      
      if (error) {
        console.error("Error fetching vendors:", error);
        throw error;
      }
      return data || [];
    },
  });

  const addVendor = useMutation({
    mutationFn: async (vendorData: {
      name: string;
      contact_person_name?: string;
      email: string;
      contact_number: string;
      address: string;
      gst_number: string;
      bank_account_number: string;
      ifsc_code: string;
      gst_certificate?: File;
      msme_certificate?: File;
    }) => {
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;

      // Upload GST certificate if provided
      if (vendorData.gst_certificate) {
        const fileName = `gst_${Date.now()}_${vendorData.gst_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, vendorData.gst_certificate);
        
        if (uploadError) throw uploadError;
        gstCertificateUrl = fileName;
      }

      // Upload MSME certificate if provided
      if (vendorData.msme_certificate) {
        const fileName = `msme_${Date.now()}_${vendorData.msme_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, vendorData.msme_certificate);
        
        if (uploadError) throw uploadError;
        msmeCertificateUrl = fileName;
      }

      // Generate vendor code
      const { data: lastVendor } = await supabase
        .from("vendors")
        .select("vendor_code")
        .order("vendor_code", { ascending: false })
        .limit(1);

      let vendorCode = "VEN001";
      if (lastVendor && lastVendor.length > 0) {
        const lastCode = lastVendor[0].vendor_code;
        const numericPart = parseInt(lastCode.replace("VEN", "")) + 1;
        vendorCode = `VEN${numericPart.toString().padStart(3, "0")}`;
      }

      // Insert vendor
      const { data, error } = await supabase
        .from("vendors")
        .insert({
          vendor_code: vendorCode,
          name: vendorData.name,
          contact_person_name: vendorData.contact_person_name,
          email: vendorData.email,
          contact_number: vendorData.contact_number,
          address: vendorData.address,
          gst_number: vendorData.gst_number,
          bank_account_number: vendorData.bank_account_number,
          ifsc_code: vendorData.ifsc_code,
          gst_certificate_url: gstCertificateUrl,
          msme_certificate_url: msmeCertificateUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor added successfully");
    },
    onError: (error) => {
      console.error("Error adding vendor:", error);
      toast.error("Failed to add vendor");
    },
  });

  const updateVendor = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      contact_person_name?: string;
      email: string;
      contact_number: string;
      address: string;
      gst_number: string;
      bank_account_number: string;
      ifsc_code: string;
      gst_certificate?: File;
      msme_certificate?: File;
    }) => {
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;

      // Upload new GST certificate if provided
      if (data.gst_certificate) {
        const fileName = `gst_${Date.now()}_${data.gst_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, data.gst_certificate);
        
        if (uploadError) throw uploadError;
        gstCertificateUrl = fileName;
      }

      // Upload new MSME certificate if provided
      if (data.msme_certificate) {
        const fileName = `msme_${Date.now()}_${data.msme_certificate.name}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-documents")
          .upload(fileName, data.msme_certificate);
        
        if (uploadError) throw uploadError;
        msmeCertificateUrl = fileName;
      }

      const updateData: any = {
        name: data.name,
        contact_person_name: data.contact_person_name,
        email: data.email,
        contact_number: data.contact_number,
        address: data.address,
        gst_number: data.gst_number,
        bank_account_number: data.bank_account_number,
        ifsc_code: data.ifsc_code,
      };

      if (gstCertificateUrl) updateData.gst_certificate_url = gstCertificateUrl;
      if (msmeCertificateUrl) updateData.msme_certificate_url = msmeCertificateUrl;

      const { error } = await supabase
        .from("vendors")
        .update(updateData)
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor updated successfully");
    },
    onError: (error) => {
      console.error("Error updating vendor:", error);
      toast.error("Failed to update vendor");
    },
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendors")
        .update({ is_active: false })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting vendor:", error);
      toast.error("Failed to delete vendor");
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
