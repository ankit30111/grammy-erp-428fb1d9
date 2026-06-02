CREATE TABLE public.plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;

ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view plants"
ON public.plants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage plants"
ON public.plants FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

INSERT INTO public.plants (code, name) VALUES
  ('GE', 'Grammy Electronics'),
  ('GA', 'Grammy Acoustics');

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS default_plant_id uuid REFERENCES public.plants(id);