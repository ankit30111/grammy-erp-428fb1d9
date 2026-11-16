-- No backend function may be called by someone who is not logged in.
--
-- Until now every function in public could be executed by `anon` (through the
-- default PUBLIC grant and Supabase's default privileges). Most check the user
-- inside and refuse, but about ten SECURITY DEFINER functions did not.
--
-- Each function keeps exactly the rights it had for `authenticated` and
-- `service_role`. Functions that were already closed to `authenticated`
-- (ecn_apply, versions_release, apply_bom, the trigger helpers...) stay closed.

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT * FROM (
      SELECT p.oid::regprocedure::text AS sig,
             has_function_privilege('authenticated', p.oid, 'execute') AS for_users,
             has_function_privilege('service_role', p.oid, 'execute') AS for_service
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
      ORDER BY 1
    ) before_change
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.for_users THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig); END IF;
    IF f.for_service THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;

-- Functions created from now on: not callable without login either.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
