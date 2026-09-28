-- Clean-up: remove what nothing uses.
--
-- Every item below was checked on 28 Sep 2026 against: the app code, the edge
-- functions, every database function, trigger, view, policy and column
-- default. None of it is referenced, and every table dropped is empty.
--
-- 1. Restore-point copies (9 schemas snap_2026092x_*, ~90 tables each) and the
--    functions that made / restored them, plus reset_business_data. Restoring
--    any of them would have wiped everything done since, so they were risk,
--    not safety.
-- 2. The "DASH" module left from the old Lovable build: 21 empty tables, their
--    functions, enum types and two empty storage buckets.
-- 3. Three empty, unused tables: capa_checks, ht_store, production_serial_numbers
--    (serial numbers live in serial_number_assignments).
-- 4. Five sequences nothing draws from (each has a live seq_* twin).

-- 1. Restore points ----------------------------------------------------------
DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT nspname FROM pg_namespace WHERE nspname ~ '^snap_[0-9]{8}_[0-9]{6}$' LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', s);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'snapshots')
     AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'snapshots') THEN
    DROP SCHEMA snapshots;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.create_restore_point(text);
DROP FUNCTION IF EXISTS public.drop_restore_point(text);
DROP FUNCTION IF EXISTS public.restore_from_point(text);
DROP FUNCTION IF EXISTS public.reset_business_data(text);
DROP TABLE IF EXISTS public.restore_points;

-- 2. DASH module ---------------------------------------------------------------
DO $$
DECLARE t text; n bigint;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'dash\_%' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'dash table % has % rows - stopping, nothing dropped', t, n; END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS
  public.dash_customer_documents, public.dash_payments, public.dash_sales_order_items, public.dash_sales_orders,
  public.dash_customers, public.dash_service_history, public.dash_spare_consumption, public.dash_service_tickets,
  public.dash_spare_dispatch_log, public.dash_product_spares, public.dash_spare_parts, public.dash_product_spare_parts,
  public.dash_product_artwork, public.dash_product_compliance, public.dash_product_documents,
  public.dash_product_qc_checklist, public.dash_product_specs, public.dash_inventory_movements, public.dash_inventory,
  public.dash_factory_orders, public.dash_products
  CASCADE;

DROP FUNCTION IF EXISTS public.update_dash_product_specs_updated_at();
DROP FUNCTION IF EXISTS public.calculate_dash_product_pricing();
DROP FUNCTION IF EXISTS public.generate_dash_fo_number();
DROP FUNCTION IF EXISTS public.generate_dash_so_number();
DROP FUNCTION IF EXISTS public.generate_dash_ticket_number();
DROP FUNCTION IF EXISTS public.set_dash_fo_number();
DROP FUNCTION IF EXISTS public.set_dash_so_number();
DROP FUNCTION IF EXISTS public.set_dash_ticket_number();
DROP FUNCTION IF EXISTS public.dash_update_inventory_on_grn();
DROP FUNCTION IF EXISTS public.get_dash_customer_finance(uuid);

DROP TYPE IF EXISTS public.dash_artwork_type, public.dash_customer_type, public.dash_dispatch_status,
  public.dash_factory_order_status, public.dash_movement_type, public.dash_payment_status,
  public.dash_product_category, public.dash_product_status, public.dash_qc_status,
  public.dash_repair_status, public.dash_spare_dispatch_type;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id IN ('dash-documents', 'dash-product-docs')) THEN
    BEGIN
      DELETE FROM storage.buckets WHERE id IN ('dash-documents', 'dash-product-docs');
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Empty dash buckets left in place (storage refuses SQL deletes): %', SQLERRM;
    END;
  END IF;
END $$;

-- 3. Unused empty tables -------------------------------------------------------
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['capa_checks', 'ht_store', 'production_serial_numbers'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN RAISE EXCEPTION '% has % rows - stopping', t, n; END IF;
      EXECUTE format('DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 4. Sequences nothing draws from ---------------------------------------------
DROP SEQUENCE IF EXISTS public.dispatch_order_seq, public.grn_number_seq, public.kit_number_seq,
  public.po_number_seq, public.spare_order_seq;
