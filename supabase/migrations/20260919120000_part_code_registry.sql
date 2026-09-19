-- One directory, one code shape, and one place that decides which letter is free.
--
-- The rule Ankit set is that every part - purchased material, semi-finished,
-- sub-assembly, finished good - lives in the same directory under a letter and a
-- number, and that no letter is ever used for two things. Until now the letters
-- lived in a hand-typed array in PartsManagement.tsx, which is not a place a rule
-- can be enforced: it cannot stop a second screen, an import, or next month from
-- handing out F-001 to a finished good while F-001 is already a gasket.
--
-- So the letters become a table. A part code is issued by the database against a
-- row in that table, the prefix is checked on the way in, and the kind of part is
-- read from the category rather than typed again beside it.
--
-- Two things this deliberately does NOT do:
--
--   * It does not renumber anything. The 2,290 existing codes are on drawings,
--     vendor purchase orders and cartons; they are grandfathered exactly as they
--     are, including the E-002A / R-04CL / T-19 shapes that predate the pattern.
--   * It does not invent letters for soundbars, semi-finished or sub-assembled
--     parts. Seventeen letters are taken and nine are free (G H I J N Q U V X);
--     which of them means what is Grammy's decision, made in the app when the
--     first such part is created, not a guess buried in a migration.
--
-- J is seeded as Party Speaker because that is already what J means here - J1,
-- J3, J4SM, J6C are party speakers in the master's USED IN column. S is NOT
-- seeded for soundbars: S is Stickers, with 325 live codes, and that collision is
-- exactly what this table exists to prevent.

-- ---------------------------------------------------------------------------
-- The registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.part_categories (
  prefix        text PRIMARY KEY CHECK (prefix ~ '^[A-Z]{1,2}$'),
  name          text NOT NULL UNIQUE,
  kind          public.part_source_type NOT NULL,
  -- The next number this letter will issue. Held here rather than computed as
  -- max()+1 so that two people creating a part at the same moment cannot be
  -- handed the same code: the issuer takes a row lock on this row.
  next_sequence int  NOT NULL DEFAULT 1 CHECK (next_sequence > 0),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.part_categories IS
  'Every part-code prefix in use, what it means, and what kind of part it holds. One letter, one meaning, forever.';

DROP TRIGGER IF EXISTS trg_touch_part_categories ON public.part_categories;
CREATE TRIGGER trg_touch_part_categories
  BEFORE UPDATE ON public.part_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- The seventeen letters already in circulation, named for what the parts under
-- them actually are. C and Y are named for their contents, not for the master
-- workbook's tab titles: the "C-CONNECTOR" tab holds power cords and RCA leads,
-- and the "Y-WIRES" tab holds connectors. The tabs are crossed; the parts are not.
INSERT INTO public.part_categories (prefix, name, kind) VALUES
  ('A', 'Software',        'PURCHASED'),
  ('B', 'Packaging',       'PURCHASED'),
  ('C', 'Wire',            'PURCHASED'),
  ('D', 'Consumables',     'PURCHASED'),
  ('E', 'PCB',             'PURCHASED'),
  ('F', 'Gasket',          'PURCHASED'),
  ('K', 'PCB Components',  'PURCHASED'),
  ('L', 'Loudspeaker',     'PURCHASED'),
  ('M', 'Metal',           'PURCHASED'),
  ('O', 'Others',          'PURCHASED'),
  ('P', 'Plastic',         'PURCHASED'),
  ('R', 'Remote',          'PURCHASED'),
  ('S', 'Sticker',         'PURCHASED'),
  ('T', 'Transformer',     'PURCHASED'),
  ('W', 'Wooden',          'PURCHASED'),
  ('Y', 'Connector',       'PURCHASED'),
  ('Z', 'Screw',           'PURCHASED'),
  ('J', 'Party Speaker',   'FINISHED_GOOD')
ON CONFLICT (prefix) DO NOTHING;

-- Start each letter after the highest number it has already issued, so no new
-- code can land on an existing one. Z runs to 62 and R to 8 even though the
-- counts are 58 and 22, because some numbers were skipped and some carry a
-- suffix - max() is the only safe starting point.
UPDATE public.part_categories pc
   SET next_sequence = GREATEST(pc.next_sequence, sub.hi + 1)
  FROM (
    SELECT split_part(p.part_code, '-', 1) AS prefix,
           max((regexp_match(p.part_code, '^[A-Z]{1,2}-0*([0-9]+)'))[1]::int) AS hi
      FROM public.parts p
     WHERE p.part_code ~ '^[A-Z]{1,2}-[0-9]'
     GROUP BY 1
  ) sub
 WHERE sub.prefix = pc.prefix AND sub.hi IS NOT NULL;

-- ---------------------------------------------------------------------------
-- parts.category holds the prefix
-- ---------------------------------------------------------------------------
-- It already does for all 2,290 imported rows - 'P', 'S', 'E' and so on. The Add
-- form, however, wrote the category's NAME ('Plastic'), so the first part created
-- through the screen would have been the only row in the table keyed differently
-- from every other, and the category filter would never have matched it. Nothing
-- has been created through that form yet, so this is a latent bug being closed
-- rather than data being repaired.
UPDATE public.parts SET category = 'J' WHERE category = 'Finished Good';

-- ---------------------------------------------------------------------------
-- Issue a code
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_part_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind public.part_source_type;
  v_seq  int;
  v_code text;
BEGIN
  -- FOR UPDATE is the whole point: it serialises two people pressing Create at
  -- the same instant, so the second one waits and gets the next number instead
  -- of the same one.
  SELECT kind, next_sequence INTO v_kind, v_seq
    FROM public.part_categories
   WHERE prefix = upper(p_prefix) AND is_active
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active part category with prefix "%"', upper(p_prefix);
  END IF;

  -- Walk past anything already taken. The imported codes have gaps and suffixes
  -- (E-002A, T-19), so a counter alone is not proof a code is free.
  LOOP
    v_code := upper(p_prefix) || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code);
    v_seq := v_seq + 1;
  END LOOP;

  UPDATE public.part_categories
     SET next_sequence = v_seq + 1, updated_at = now()
   WHERE prefix = upper(p_prefix);

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.next_part_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_part_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Guard the door
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parts_enforce_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind   public.part_source_type;
  v_prefix text;
BEGIN
  SELECT kind INTO v_kind
    FROM public.part_categories
   WHERE prefix = NEW.category;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Part category "%" is not in the part code registry. Add the category first, so its letter is reserved.',
      NEW.category;
  END IF;

  -- The category decides the kind. Storing it on the part as well is a second
  -- copy of one fact, and two copies drift; this makes the part follow the
  -- category rather than letting a screen set them to different things.
  NEW.source_type := v_kind;

  -- Only new codes have to match the pattern. Every code already in the table
  -- stays exactly as it is - they are printed on drawings and vendor POs, and a
  -- migration is not allowed to rename them.
  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    IF NEW.part_code !~ '^[A-Z]{1,2}-[0-9]{3,}$' THEN
      RAISE EXCEPTION
        'Part code "%" is not in the LETTER-NUMBER form (for example P-472).', NEW.part_code;
    END IF;
    v_prefix := split_part(NEW.part_code, '-', 1);
    IF v_prefix <> NEW.category THEN
      RAISE EXCEPTION
        'Part code "%" starts with "%" but the category is "%". The letter and the category must agree.',
        NEW.part_code, v_prefix, NEW.category;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parts_enforce_category ON public.parts;
CREATE TRIGGER trg_parts_enforce_category
  BEFORE INSERT OR UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.parts_enforce_category();

-- ---------------------------------------------------------------------------
-- Who may read and change the registry
-- ---------------------------------------------------------------------------
ALTER TABLE public.part_categories ENABLE ROW LEVEL SECURITY;

-- Read and write match `parts` itself: anyone signed in can see the categories,
-- because every screen that shows a part code needs to say what the letter means;
-- only an admin can reserve one. Reserving a letter outlives everybody in the
-- room, so it is not something to do in passing.
DROP POLICY IF EXISTS part_categories_read ON public.part_categories;
CREATE POLICY part_categories_read ON public.part_categories
  FOR SELECT TO authenticated USING (public.has_role(NULL));

DROP POLICY IF EXISTS part_categories_write ON public.part_categories;
CREATE POLICY part_categories_write ON public.part_categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.part_categories TO authenticated;
GRANT INSERT, UPDATE ON public.part_categories TO authenticated;

-- ---------------------------------------------------------------------------
-- Which letters are still free
-- ---------------------------------------------------------------------------
-- A view rather than a list in the app, so the answer cannot go stale the moment
-- somebody reserves one.
CREATE OR REPLACE VIEW public.free_part_prefixes AS
  SELECT l AS prefix
    FROM unnest(ARRAY[
      'A','B','C','D','E','F','G','H','I','J','K','L','M',
      'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
    ]) AS l
   WHERE l NOT IN (SELECT prefix FROM public.part_categories)
   ORDER BY l;

GRANT SELECT ON public.free_part_prefixes TO authenticated;
