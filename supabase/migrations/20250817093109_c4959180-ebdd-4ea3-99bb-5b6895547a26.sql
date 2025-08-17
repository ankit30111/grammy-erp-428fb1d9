
BEGIN;

-- 1) Normalize item statuses: any completed item without a report goes back to PENDING
UPDATE public.grn_items
SET iqc_status = 'PENDING',
    iqc_completed_at = NULL,
    iqc_completed_by = NULL
WHERE (iqc_status IN ('APPROVED','REJECTED','SEGREGATED','FAILED'))
  AND (iqc_report_url IS NULL OR trim(iqc_report_url) = '');

-- 2) Recalculate each GRN header status from items (skip STORE_RECEIVED)
-- If any item is pending => RECEIVED; else => IQC_COMPLETED
UPDATE public.grn g
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.grn_items gi
    WHERE gi.grn_id = g.id
      AND (gi.iqc_status IS NULL OR gi.iqc_status = 'PENDING')
  )
  THEN 'RECEIVED'
  ELSE 'IQC_COMPLETED'
END
WHERE g.status <> 'STORE_RECEIVED';

-- 3) Keep GRN header status in sync going forward
CREATE OR REPLACE FUNCTION public.sync_grn_status_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_grn_id uuid;
  v_has_pending boolean;
BEGIN
  v_grn_id := COALESCE(NEW.grn_id, OLD.grn_id);
  IF v_grn_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Do not override STORE_RECEIVED (downstream process)
  IF EXISTS (SELECT 1 FROM public.grn WHERE id = v_grn_id AND status = 'STORE_RECEIVED') THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.grn_items gi
    WHERE gi.grn_id = v_grn_id
      AND (gi.iqc_status IS NULL OR gi.iqc_status = 'PENDING')
  ) INTO v_has_pending;

  UPDATE public.grn
  SET status = CASE WHEN v_has_pending THEN 'RECEIVED' ELSE 'IQC_COMPLETED' END
  WHERE id = v_grn_id;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_grn_status_from_items ON public.grn_items;
CREATE TRIGGER trg_sync_grn_status_from_items
AFTER INSERT OR UPDATE OR DELETE ON public.grn_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_grn_status_from_items();

COMMIT;
