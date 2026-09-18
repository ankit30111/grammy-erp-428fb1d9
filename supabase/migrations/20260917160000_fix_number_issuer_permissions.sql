-- Fix: "permission denied for function next_po_number"
--
-- Root cause (migration 20260917132451 — the hardening pass):
--   REVOKE ALL ON FUNCTION public.next_po_number()            FROM authenticated;
--   REVOKE ALL ON FUNCTION public.next_doc_number(text,regclass) FROM PUBLIC, anon, authenticated;
--   ...on the comment "internal number issuers are never called directly".
--
-- They ARE called indirectly: from BEFORE INSERT trigger functions that were left
-- SECURITY INVOKER, so they execute as the signed-in user, who now has no EXECUTE.
-- Every document number in the system is therefore dead, not just the PO number.
--
-- Correct fix: make the trigger functions SECURITY DEFINER so they run as the owner.
-- The REVOKEs stay intact — a user still cannot call an issuer directly and burn numbers.
-- Bodies are unchanged; all nine already pin search_path and fully qualify every reference.

-- issuer: next_po_number()  (PO creation — the reported failure)
ALTER FUNCTION public.set_po_number()          SECURITY DEFINER;



-- issuer: next_doc_number(text, regclass)  (revoked from PUBLIC, anon AND authenticated)
ALTER FUNCTION public.set_grn_number()         SECURITY DEFINER;  -- goods receipt
ALTER FUNCTION public.set_kit_number()         SECURITY DEFINER;  -- kit issue
ALTER FUNCTION public.set_voucher_number()     SECURITY DEFINER;  -- production voucher
ALTER FUNCTION public.set_dispatch_number()    SECURITY DEFINER;  -- dispatch
ALTER FUNCTION public.set_request_number()     SECURITY DEFINER;  -- material request
ALTER FUNCTION public.set_spare_order_number() SECURITY DEFINER;  -- spare order
ALTER FUNCTION public.set_capa_number()        SECURITY DEFINER;  -- CAPA
ALTER FUNCTION public.set_complaint_number()   SECURITY DEFINER;  -- customer complaint

-- Proof. Run as a normal signed-in user, not as postgres/service_role.
-- Expected: GAPO-09_01 on the first PO of September 2026.
--
--   set local role authenticated;
--   insert into public.purchase_orders (...) values (...);
--   select po_number from public.purchase_orders order by created_at desc limit 1;
--   select * from public.document_counters;
--   -- then roll back so Ankit's real first PO is still GAPO-09_01

-- APPLIED 2026-09-18 and verified by execution, not by reading grants:
--   BEGIN; SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<admin uuid>","role":"authenticated"}';
--   INSERT INTO public.purchase_orders (plant_id, vendor_id, promised_delivery_date, created_by) ...
--   -> ran_as = authenticated, po_number = GAPO-09_01, status = DRAFT
--   Transaction rolled back: purchase_orders = 0 rows, document_counters empty,
--   so the first real PO is still GAPO-09_01.
