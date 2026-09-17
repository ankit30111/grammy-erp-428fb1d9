-- 1. No SECURITY DEFINER function in public is callable without signing in.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, (p.prorettype = 'pg_catalog.trigger'::regtype) AS is_trigger
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    -- trigger functions and internal number issuers are never called directly
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.next_po_number() FROM authenticated;
REVOKE ALL ON FUNCTION public.next_doc_number(text, regclass) FROM PUBLIC, anon, authenticated;

-- 2. document_counters: internal serial store, administrators may read it.
CREATE POLICY document_counters_admin_read ON public.document_counters
  FOR SELECT TO authenticated USING (public.is_admin());