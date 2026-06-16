GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;
GRANT ALL ON public.production_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plants TO authenticated;
GRANT ALL ON public.user_plants TO service_role;