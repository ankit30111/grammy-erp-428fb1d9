
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CAPAForIQC {
  id: string;
  capa_category: string;
  part_or_process: string;
  vendor_name: string | null;
  approved_at: string;
  status: string;
  raw_material_id: string;
  vendor_id: string | null;
}

export interface CAPAImplementationCheck {
  id?: string;
  capa_category: string;
  reference_id: string;
  grn_item_id: string;
  raw_material_id: string;
  vendor_id: string | null;
  implemented: boolean;
  remarks: string;
}

export const useCAPATracking = () => {
  // Fetch relevant CAPAs for a specific material and vendor during IQC
  const fetchRelevantCAPAs = (materialId: string, vendorId: string) => {
    return useQuery({
      queryKey: ['relevant-capas', materialId, vendorId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('capa_tracking_with_links')
          .select('*')
          .eq('status', 'APPROVED')
          .or(`and(capa_category.eq.VENDOR,vendor_id.eq.${vendorId},raw_material_id.eq.${materialId}),and(capa_category.eq.PART_ANALYSIS,raw_material_id.eq.${materialId})`)
          .order('approved_at', { ascending: false });

        if (error) throw error;
        return data as CAPAForIQC[];
      },
      enabled: !!materialId && !!vendorId,
    });
  };

  // Submit CAPA implementation checks
  const submitCAPAChecks = async (checks: CAPAImplementationCheck[]) => {
    const { error } = await supabase
      .from('capa_implementation_checks')
      .insert(checks);

    if (error) throw error;
  };

  // Get CAPA implementation history for tracking
  const fetchCAPAImplementationHistory = (capaCategory: string, referenceId: string) => {
    return useQuery({
      queryKey: ['capa-implementation-history', capaCategory, referenceId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('capa_implementation_checks')
          .select(`
            *,
            user_accounts!capa_implementation_checks_verified_by_fkey(full_name)
          `)
          .eq('capa_category', capaCategory)
          .eq('reference_id', referenceId)
          .order('verified_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!capaCategory && !!referenceId,
    });
  };

  return {
    fetchRelevantCAPAs,
    submitCAPAChecks,
    fetchCAPAImplementationHistory,
  };
};
