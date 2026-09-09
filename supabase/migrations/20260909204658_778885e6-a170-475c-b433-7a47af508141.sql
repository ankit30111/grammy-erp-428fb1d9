REVOKE ALL ON FUNCTION public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_stock_movements(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_stock_movements(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.stock_ledger_append_only() FROM PUBLIC, anon;