import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PartSourceType =
  | "PURCHASED"
  | "ASSEMBLED_STOCKED"
  | "ASSEMBLED_INLINE"
  | "FINISHED_GOOD";

// The names Grammy uses, not the enum's. ASSEMBLED_INLINE and ASSEMBLED_STOCKED
// are the ledger's words for "never stocked" and "stocked and reissued"; on the
// floor those are a semi-finished good and a sub-assembly.
export const PART_SOURCE_TYPES: { value: PartSourceType; label: string }[] = [
  { value: "PURCHASED", label: "Purchase Part" },
  { value: "ASSEMBLED_INLINE", label: "Semi-finished Good" },
  { value: "ASSEMBLED_STOCKED", label: "Sub-assembled Good" },
  { value: "FINISHED_GOOD", label: "Finished Good" },
];

export interface PartInput {
  name: string;
  part_code: string;
  category: string;
  uom?: string;
  source_type?: PartSourceType;
  specification?: string;
  sourcing_type?: "IMPORTED" | "LOCAL";
  currency?: string;
  unit_price?: number;
  cbm_per_unit?: number;
  supplier_country?: string;
  is_active?: boolean;
  vendorIds?: string[];
  primaryVendorId?: string;
  specificationFile?: File;
  iqcChecklistFile?: File;
  changesDescription?: string;
}

const uploadDoc = async (folder: string, file: File, prefix?: string) => {
  const fileName = `${folder}/${prefix ? `${prefix}_` : ""}${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from("raw-material-documents")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  return fileName;
};

const syncVendors = async (partId: string, vendorIds?: string[], primaryVendorId?: string) => {
  const { error: deleteError } = await supabase
    .from("part_vendors")
    .delete()
    .eq("part_id", partId);
  if (deleteError) throw deleteError;

  if (vendorIds && vendorIds.length > 0) {
    const { error } = await supabase.from("part_vendors").insert(
      vendorIds.map((vendor_id) => ({
        part_id: partId,
        vendor_id,
        is_primary: vendor_id === primaryVendorId,
      })),
    );
    if (error) throw error;
  }
};

export const useParts = () => {
  const queryClient = useQueryClient();

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select(
          `*, part_vendors ( id, is_primary, vendor_id, vendors ( id, name, vendor_code ) )`,
        )
        .order("part_code");
      if (error) throw error;
      return data || [];
    },
    retry: 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["parts"] });
    queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
  };

  const addPart = useMutation({
    mutationFn: async (input: PartInput) => {
      const specificationUrl = input.specificationFile
        ? await uploadDoc("specifications", input.specificationFile)
        : null;
      const iqcChecklistUrl = input.iqcChecklistFile
        ? await uploadDoc("iqc_checklists", input.iqcChecklistFile)
        : null;

      const { data: part, error } = await supabase
        .from("parts")
        .insert({
          name: input.name,
          part_code: input.part_code,
          category: input.category,
          uom: input.uom || "PCS",
          source_type: input.source_type || "PURCHASED",
          specification: input.specification || null,
          sourcing_type: input.sourcing_type || "LOCAL",
          currency: input.currency || null,
          unit_price: input.unit_price ?? null,
          cbm_per_unit: input.cbm_per_unit ?? null,
          supplier_country: input.supplier_country || null,
          last_price_update: input.unit_price != null ? new Date().toISOString() : null,
          specification_sheet_url: specificationUrl,
          iqc_checklist_url: iqcChecklistUrl,
        })
        .select()
        .single();
      if (error) throw error;

      await syncVendors(part.id, input.vendorIds, input.primaryVendorId);

      if (specificationUrl || iqcChecklistUrl) {
        const { error: specError } = await supabase.from("part_specifications").insert({
          part_id: part.id,
          version_number: 1,
          specification_sheet_url: specificationUrl,
          iqc_checklist_url: iqcChecklistUrl,
          changes_description: "Initial specification upload",
        });
        if (specError) throw specError;
      }

      return part;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Part added");
    },
    onError: (error: any) => {
      if (error?.code === "23505" || error?.code === "23505" || error?.message?.includes("duplicate key")) {
        toast.error("That part code already exists. Choose a different code.");
      } else {
        toast.error(error?.message || "Could not add the part");
      }
    },
  });

  const updatePart = useMutation({
    mutationFn: async (input: PartInput & { id: string }) => {
      const specificationUrl = input.specificationFile
        ? await uploadDoc("specifications", input.specificationFile, input.id)
        : null;
      const iqcChecklistUrl = input.iqcChecklistFile
        ? await uploadDoc("iqc_checklists", input.iqcChecklistFile, input.id)
        : null;

      const updateData: Record<string, any> = {
        name: input.name,
        part_code: input.part_code,
        category: input.category,
        uom: input.uom || "PCS",
        specification: input.specification || null,
        sourcing_type: input.sourcing_type || "LOCAL",
        currency: input.currency || null,
        unit_price: input.unit_price ?? null,
        cbm_per_unit: input.cbm_per_unit ?? null,
        supplier_country: input.supplier_country || null,
      };
      if (input.source_type) updateData.source_type = input.source_type;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      if (input.unit_price != null) updateData.last_price_update = new Date().toISOString();
      if (specificationUrl) updateData.specification_sheet_url = specificationUrl;
      if (iqcChecklistUrl) updateData.iqc_checklist_url = iqcChecklistUrl;

      const { error } = await supabase.from("parts").update(updateData).eq("id", input.id);
      if (error) throw error;

      await syncVendors(input.id, input.vendorIds, input.primaryVendorId);

      if (specificationUrl || iqcChecklistUrl) {
        const { data: lastVersion } = await supabase
          .from("part_specifications")
          .select("version_number")
          .eq("part_id", input.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error: specError } = await supabase.from("part_specifications").insert({
          part_id: input.id,
          version_number: (lastVersion?.version_number || 0) + 1,
          specification_sheet_url: specificationUrl,
          iqc_checklist_url: iqcChecklistUrl,
          changes_description: input.changesDescription || "Specification update",
        });
        if (specError) throw specError;
      }

      return input;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Part updated");
    },
    onError: (error: any) => {
      if (error?.message?.includes("duplicate key")) {
        toast.error("That part code already exists. Choose a different code.");
      } else {
        toast.error(error?.message || "Could not update the part");
      }
    },
  });

  const deletePart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Part deactivated");
    },
    onError: (error: any) => toast.error(error?.message || "Could not deactivate the part"),
  });

  return {
    parts,
    isLoading,
    addPart,
    updatePart,
    deletePart,
    // aliases kept so screens not yet rewired keep working
    rawMaterials: parts,
    addRawMaterial: addPart,
    updateRawMaterial: updatePart,
    deleteRawMaterial: deletePart,
  };
};

export const useSpecificationHistory = (partId: string) => {
  return useQuery({
    queryKey: ["specification-history", partId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_specifications")
        .select("*")
        .eq("part_id", partId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partId,
  });
};

export const getDocumentUrl = async (fileName: string) => {
  const { data, error } = await supabase.storage
    .from("raw-material-documents")
    .createSignedUrl(fileName, 60 * 60);
  if (error) {
    console.error("Failed to sign document URL:", fileName, error);
    throw error;
  }
  return data?.signedUrl ?? null;
};
