-- Empty the business data, keep the system.
--
-- Ankit is starting again with real figures, and will want to do this more than
-- once: put data in, find the problem, fix it, test it, clear it out, start
-- clean. Doing that by hand means remembering which of ninety-one tables are
-- somebody's stock and which are the plant, the departments and the letters that
-- part codes are issued from. Miss one and the next run starts from a half-empty
-- database that looks fresh.
--
-- So the line is drawn once, here, and the list of what survives is the whole
-- point of the function:
--
--   KEPT   plants, stock locations, production lines   the factory
--          departments, permissions, approvals          how work moves
--          user accounts and their plants/departments   who can sign in
--          part_categories                              the part-code letters
--          document_counters                            numbering
--          restore_points                               the snapshots themselves
--
--   CLEARED  everything else - parts, vendors, customers, bills of materials,
--            purchase orders, GRNs, the stock ledger and balances, production,
--            projections, quality records, the audit log.
--
-- Counters are wound back to 1 afterwards, because a clean database that issues
-- GRN-202609-00008 is not clean.

CREATE OR REPLACE FUNCTION public.reset_business_data(p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Named, not pattern-matched. A rule like "keep anything ending in _config"
  -- silently changes meaning the day somebody adds a table, and this is not a
  -- function that should ever surprise anybody.
  v_keep text[] := ARRAY[
    'plants', 'stock_locations', 'production_lines',
    'departments', 'department_permissions', 'approval_workflows',
    'user_accounts', 'user_departments', 'user_plants',
    'part_categories', 'document_counters', 'restore_points'
  ];
  v_order   text[] := '{}';
  v_all     text[];
  v_t       text;
  v_moved   boolean;
  v_n       bigint;
  v_cleared jsonb := '{}'::jsonb;
BEGIN
  IF p_confirm IS DISTINCT FROM 'DELETE ALL BUSINESS DATA' THEN
    RAISE EXCEPTION
      'Refusing. Call with the exact phrase: select reset_business_data(''DELETE ALL BUSINESS DATA'')';
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_all
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND NOT (c.relname = ANY(v_keep));

  -- Parents before children, then emptied in reverse, so a delete never strands
  -- a row pointing at it. Same ordering the restore uses.
  LOOP
    v_moved := false;
    FOREACH v_t IN ARRAY v_all LOOP
      CONTINUE WHEN v_t = ANY(v_order);
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint con
          JOIN pg_class ch ON ch.oid = con.conrelid
          JOIN pg_class pa ON pa.oid = con.confrelid
          JOIN pg_namespace nch ON nch.oid = ch.relnamespace
         WHERE con.contype = 'f' AND nch.nspname = 'public'
           AND ch.relname = v_t AND pa.relname <> v_t
           AND pa.relname = ANY(v_all) AND NOT (pa.relname = ANY(v_order))
      ) THEN
        v_order := v_order || v_t;
        v_moved := true;
      END IF;
    END LOOP;
    EXIT WHEN NOT v_moved;
  END LOOP;
  FOREACH v_t IN ARRAY v_all LOOP
    IF NOT (v_t = ANY(v_order)) THEN v_order := v_order || v_t; END IF;
  END LOOP;

  -- Triggers off: the recompute triggers would otherwise fire on every deleted
  -- row and rewrite balances that are about to disappear anyway, and the ledger's
  -- append-only guard would refuse the delete outright.
  FOREACH v_t IN ARRAY v_order LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', v_t);
  END LOOP;

  FOR i IN REVERSE array_length(v_order, 1) .. 1 LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_order[i]) INTO v_n;
    IF v_n > 0 THEN
      EXECUTE format('DELETE FROM public.%I', v_order[i]);
      v_cleared := v_cleared || jsonb_build_object(v_order[i], v_n);
    END IF;
  END LOOP;

  FOREACH v_t IN ARRAY v_order LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', v_t);
  END LOOP;

  -- A clean database that issues GRN-202609-00008 is not clean.
  UPDATE public.part_categories SET next_sequence = 1;
  DELETE FROM public.document_counters;

  RETURN jsonb_build_object(
    'cleared', v_cleared,
    'kept', to_jsonb(v_keep),
    'tables_emptied', (SELECT count(*) FROM jsonb_object_keys(v_cleared))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_business_data(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.reset_business_data(text) IS
  'Empties every business table and keeps the factory, the people and the numbering. Takes a restore point first, by hand - this function does not take one for you.';
