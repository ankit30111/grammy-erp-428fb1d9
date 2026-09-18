
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * CAPA after the rebuild
 * ----------------------
 * The six old CAPA tables (iqc_vendor_capa, production_capa, vendor_capa,
 * capa_implementation_checks) and the two views (capa_approvals_view,
 * capa_tracking_with_links) were collapsed into a single `capa` table.
 *   capa_status       -> status        (capa_status enum)
 *   capa_document_url -> document_url
 *   initiated_at      -> created_at
 *   AWAITED -> OPEN, RECEIVED -> SUBMITTED, APPROVED -> ACCEPTED
 * `source` is the text discriminator that used to be the table name
 * ('IQC' | 'PRODUCTION' | 'VENDOR' | 'CUSTOMER'), and grn_item_id /
 * production_order_id / line_rejection_id link back to the origin record.
 *
 * capa_implementation_checks has NO replacement — per-inspection CAPA
 * verification is not recorded anywhere in the rebuilt schema.
 */
export const CAPA_IMPLEMENTATION_CHECKS_UNAVAILABLE =
  'CAPA implementation checks are not available after the database rebuild.';

export interface CAPAForIQC {
  id: string;
  capa_category: string;
  part_or_process: string;
  vendor_name: string | null;
  approved_at: string;
  status: string;
  part_id: string;
  vendor_id: string | null;
}

export interface CAPAImplementationCheck {
  id?: string;
  capa_category: string;
  reference_id: string;
  grn_item_id: string;
  part_id: string;
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
          .from('capa')
          .select(`
            id,
            source,
            status,
            part_id,
            vendor_id,
            updated_at,
            parts (name, part_code),
            vendors (name)
          `)
          .eq('status', 'ACCEPTED')
          .eq('part_id', materialId)
          .or(`vendor_id.eq.${vendorId},vendor_id.is.null`)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((row: any): CAPAForIQC => ({
          id: row.id,
          capa_category: row.source || 'UNKNOWN',
          part_or_process: row.parts?.name || row.parts?.part_code || '-',
          vendor_name: row.vendors?.name ?? null,
          approved_at: row.updated_at,
          status: row.status,
          part_id: row.part_id,
          vendor_id: row.vendor_id,
        }));
      },
      enabled: !!materialId && !!vendorId,
    });
  };

  /**
   * capa_implementation_checks is gone and has no replacement table, so these
   * checks cannot be persisted. We keep the call site intact but never pretend
   * the data was saved — the IQC screen shows an explicit notice instead.
   */
  const submitCAPAChecks = async (checks: CAPAImplementationCheck[]) => {
    if (checks.length > 0) {
      console.warn(CAPA_IMPLEMENTATION_CHECKS_UNAVAILABLE, checks);
    }
  };

  // Implementation history lived in capa_implementation_checks — no replacement.
  const fetchCAPAImplementationHistory = (capaCategory: string, referenceId: string) => {
    return useQuery({
      queryKey: ['capa-implementation-history', capaCategory, referenceId],
      queryFn: async () => [] as never[],
      enabled: false,
    });
  };

  return {
    fetchRelevantCAPAs,
    submitCAPAChecks,
    fetchCAPAImplementationHistory,
  };
};
