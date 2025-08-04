-- PHASE 2: Fix function security issues and complete security hardening (corrected)

-- Fix search path for all functions to prevent SQL injection
ALTER FUNCTION public.update_production_discrepancies_updated_at() SET search_path = '';
ALTER FUNCTION public.update_complaint_status_on_parts_closure() SET search_path = '';
ALTER FUNCTION public.update_iqc_vendor_capa_updated_at() SET search_path = '';
ALTER FUNCTION public.update_production_capa_updated_at() SET search_path = '';
ALTER FUNCTION public.set_vendor_code() SET search_path = '';
ALTER FUNCTION public.generate_po_number() SET search_path = '';
ALTER FUNCTION public.generate_vendor_code() SET search_path = '';
ALTER FUNCTION public.generate_grn_number() SET search_path = '';
ALTER FUNCTION public.create_store_discrepancy() SET search_path = '';
ALTER FUNCTION public.log_production_receipt_with_discrepancy(uuid, uuid, integer, integer, uuid, text) SET search_path = '';
ALTER FUNCTION public.create_vendor_capa_on_iqc_status() SET search_path = '';
ALTER FUNCTION public.update_inventory_from_grn() SET search_path = '';
ALTER FUNCTION public.update_projection_scheduled_quantity() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.resolve_production_receipt_discrepancy(uuid, text, uuid, text) SET search_path = '';
ALTER FUNCTION public.renumber_vouchers_after_deletion(text) SET search_path = '';
ALTER FUNCTION public.update_po_received_quantities() SET search_path = '';
ALTER FUNCTION public.update_inventory_from_store_verification() SET search_path = '';
ALTER FUNCTION public.generate_temp_part_code(text) SET search_path = '';
ALTER FUNCTION public.log_production_dispatch() SET search_path = '';
ALTER FUNCTION public.generate_complaint_number() SET search_path = '';
ALTER FUNCTION public.update_npd_updated_at_column() SET search_path = '';
ALTER FUNCTION public.set_complaint_number() SET search_path = '';
ALTER FUNCTION public.update_kit_preparation_updated_at() SET search_path = '';
ALTER FUNCTION public.update_kit_items_updated_at() SET search_path = '';
ALTER FUNCTION public.log_inventory_movements() SET search_path = '';
ALTER FUNCTION public.log_production_material_receipt(uuid, uuid, integer, uuid, text) SET search_path = '';
ALTER FUNCTION public.log_material_movement(uuid, text, integer, uuid, text, text, text) SET search_path = '';
ALTER FUNCTION public.log_production_material_receipt_with_discrepancy_check(uuid, uuid, integer, uuid, text) SET search_path = '';
ALTER FUNCTION public.resolve_production_discrepancy(uuid, text, uuid, text) SET search_path = '';
ALTER FUNCTION public.create_complaints_from_batch(uuid) SET search_path = '';
ALTER FUNCTION public.create_vendor_capa_and_whatsapp_notification() SET search_path = '';
ALTER FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb) SET search_path = '';
ALTER FUNCTION public.set_kit_number() SET search_path = '';
ALTER FUNCTION public.generate_dispatch_order_number() SET search_path = '';
ALTER FUNCTION public.set_dispatch_order_number() SET search_path = '';
ALTER FUNCTION public.generate_spare_order_number() SET search_path = '';
ALTER FUNCTION public.set_spare_order_number() SET search_path = '';
ALTER FUNCTION public.generate_kit_number() SET search_path = '';
ALTER FUNCTION public.set_po_number() SET search_path = '';
ALTER FUNCTION public.set_grn_number() SET search_path = '';
ALTER FUNCTION public.generate_material_code(text) SET search_path = '';
ALTER FUNCTION public.set_material_code() SET search_path = '';

-- Add audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Log role changes in user_accounts
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.log_audit_event(
      'ROLE_CHANGE',
      'user_accounts',
      NEW.id,
      jsonb_build_object('old_role', OLD.role),
      jsonb_build_object('new_role', NEW.role)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for user role change auditing
DROP TRIGGER IF EXISTS audit_user_role_changes_trigger ON user_accounts;
CREATE TRIGGER audit_user_role_changes_trigger
  AFTER UPDATE ON user_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_role_changes();

-- Add security documentation comment
COMMENT ON SCHEMA public IS 'Security Note: Enable password leak protection in Supabase Auth settings dashboard';