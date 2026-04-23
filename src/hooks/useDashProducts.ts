import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashProducts = () => {
  return useQuery({
    queryKey: ["dash-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductMutations = () => {
  const queryClient = useQueryClient();

  const addProduct = useMutation({
    mutationFn: async (product: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_products")
        .insert(product as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-products"] });
      toast.success("Product added successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_products")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-products"] });
      toast.success("Product updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addProduct, updateProduct };
};

// Documents hooks
export const useDashProductDocuments = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-documents", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_documents")
        .select("*")
        .eq("product_id", productId!)
        .order("document_type")
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductDocumentMutations = () => {
  const queryClient = useQueryClient();

  const uploadDocument = useMutation({
    mutationFn: async ({
      productId, documentType, file, uploadedBy,
    }: { productId: string; documentType: string; file: File; uploadedBy?: string }) => {
      // Mark old versions as not current
      await supabase
        .from("dash_product_documents")
        .update({ is_current: false } as any)
        .eq("product_id", productId)
        .eq("document_type", documentType)
        .eq("is_current", true);

      // Get next version
      const { data: existing } = await supabase
        .from("dash_product_documents")
        .select("version")
        .eq("product_id", productId)
        .eq("document_type", documentType)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version || 0) + 1;

      // Upload file to dash-product-docs bucket. Store the raw bucket path
      // (not a public URL) so readers can sign it on demand — bucket is being
      // flipped to private in migration 003f.
      const filePath = `${productId}/${documentType}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("dash-product-docs")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      // Insert record
      const { data, error } = await supabase
        .from("dash_product_documents")
        .insert({
          product_id: productId,
          document_type: documentType,
          doc_type: documentType,
          doc_name: file.name,
          file_name: file.name,
          file_url: filePath,
          version: nextVersion,
          is_current: true,
          uploaded_by: uploadedBy,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-documents", vars.productId] });
      toast.success("Document uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { uploadDocument };
};

// Spares hooks (legacy junction table)
export const useDashProductSpares = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-spares", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_spares")
        .select("*, dash_spare_parts(*)")
        .eq("product_id", productId!);
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductSpareMutations = () => {
  const queryClient = useQueryClient();

  const linkSpare = useMutation({
    mutationFn: async ({ productId, spareId }: { productId: string; spareId: string }) => {
      const { data, error } = await supabase
        .from("dash_product_spares")
        .insert({ product_id: productId, spare_id: spareId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-spares", vars.productId] });
      toast.success("Spare linked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkSpare = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("dash_product_spares")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-spares"] });
      toast.success("Spare unlinked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { linkSpare, unlinkSpare };
};

// Product Spare Parts (new standalone table)
export const useDashProductSpareParts = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-spare-parts", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_spare_parts")
        .select("*")
        .eq("product_id", productId!)
        .order("part_name");
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductSparePartsMutations = () => {
  const queryClient = useQueryClient();

  const addSparePart = useMutation({
    mutationFn: async (part: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_product_spare_parts")
        .insert(part as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-spare-parts"] });
      toast.success("Spare part added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSparePart = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_product_spare_parts")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-spare-parts"] });
      toast.success("Spare part updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSparePart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dash_product_spare_parts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-spare-parts"] });
      toast.success("Spare part removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addSparePart, updateSparePart, deleteSparePart };
};

// Product Specs hooks
export const useDashProductSpecs = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-specs", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_specs")
        .select("*")
        .eq("product_id", productId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductSpecsMutations = () => {
  const queryClient = useQueryClient();

  const upsertSpecs = useMutation({
    mutationFn: async (specs: Record<string, unknown>) => {
      const productId = specs.product_id as string;
      // Check if exists
      const { data: existing } = await supabase
        .from("dash_product_specs")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("dash_product_specs")
          .update(specs as any)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("dash_product_specs")
          .insert(specs as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-specs"] });
      toast.success("Specs saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { upsertSpecs };
};

// QC Checklist hooks
export const useDashProductQCChecklist = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-qc-checklist", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_qc_checklist")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order")
        .order("parameter_name");
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductQCChecklistMutations = () => {
  const queryClient = useQueryClient();

  const addItem = useMutation({
    mutationFn: async (item: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_product_qc_checklist")
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-qc-checklist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dash_product_qc_checklist")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-qc-checklist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addItem, deleteItem };
};

// Compliance hooks
export const useDashProductCompliance = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-product-compliance", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_product_compliance")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductComplianceMutations = () => {
  const queryClient = useQueryClient();

  const upsertCompliance = useMutation({
    mutationFn: async (compliance: Record<string, unknown>) => {
      if ((compliance as any).id) {
        const { id, ...updates } = compliance as any;
        const { data, error } = await supabase
          .from("dash_product_compliance")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("dash_product_compliance")
          .insert(compliance as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-product-compliance"] });
      toast.success("Compliance saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { upsertCompliance };
};

// Spare parts list
export const useDashSpareParts = () => {
  return useQuery({
    queryKey: ["dash-spare-parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_spare_parts")
        .select("*")
        .order("spare_name");
      if (error) throw error;
      return data;
    },
  });
};

// Grammy ERP products for model number dropdown
export const useGrammyProducts = () => {
  return useQuery({
    queryKey: ["grammy-products-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code")
        .order("product_code");
      if (error) throw error;
      return data;
    },
  });
};
