DROP POLICY IF EXISTS "Authenticated users can view plants" ON public.plants;
CREATE POLICY "Plants visible to admin or assigned users"
ON public.plants
FOR SELECT
TO authenticated
USING (
  public.auth_is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_plants up
    WHERE up.user_id = (SELECT auth.uid()) AND up.plant_id = public.plants.id
  )
);