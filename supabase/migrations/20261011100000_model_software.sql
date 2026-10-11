-- Software of a model (MCU firmware, DSP settings, BT module, app ...) and the
-- history of its versions. Kept on the model, so every brand code of the model
-- (JA-006-PH, JA-006-AW) shows the same list. R&D, Management and Admin write.

CREATE TABLE IF NOT EXISTS public.model_software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS model_software_name_uq ON public.model_software (model_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.model_software_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id uuid NOT NULL REFERENCES public.model_software(id) ON DELETE CASCADE,
  version text NOT NULL CHECK (btrim(version) <> ''),
  released_on date NOT NULL DEFAULT public.ist_today(),
  details text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS model_software_versions_uq ON public.model_software_versions (software_id, lower(btrim(version)));

-- Software belongs to a model, not to a brand code or a part.
CREATE OR REPLACE FUNCTION public.model_software_check() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE id = NEW.model_id AND source_type = 'MODEL') THEN
    RAISE EXCEPTION 'Software is kept on the model (JA-006), not on a brand code or part';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_model_software_check ON public.model_software;
CREATE TRIGGER trg_model_software_check BEFORE INSERT OR UPDATE OF model_id, name ON public.model_software
  FOR EACH ROW EXECUTE FUNCTION public.model_software_check();

CREATE OR REPLACE FUNCTION public.model_software_versions_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.version := btrim(NEW.version);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_model_software_versions_touch ON public.model_software_versions;
CREATE TRIGGER trg_model_software_versions_touch BEFORE INSERT OR UPDATE ON public.model_software_versions
  FOR EACH ROW EXECUTE FUNCTION public.model_software_versions_touch();

ALTER TABLE public.model_software ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_software_versions ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['model_software', 'model_software_versions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role())', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_edit_masters()) WITH CHECK (public.can_edit_masters())', t || '_write', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_software, public.model_software_versions TO authenticated;

-- Who made / last changed a version, for the history. Logins are readable only by
-- their owner, so the view runs as its owner and checks staff access itself.
DROP VIEW IF EXISTS public.model_software_history;
CREATE VIEW public.model_software_history AS
SELECT v.*, s.model_id, s.name AS software_name,
       cu.full_name AS created_by_name, uu.full_name AS updated_by_name
  FROM public.model_software_versions v
  JOIN public.model_software s ON s.id = v.software_id
  LEFT JOIN public.user_accounts cu ON cu.id = v.created_by
  LEFT JOIN public.user_accounts uu ON uu.id = v.updated_by
 WHERE public.has_role();
GRANT SELECT ON public.model_software_history TO authenticated;
