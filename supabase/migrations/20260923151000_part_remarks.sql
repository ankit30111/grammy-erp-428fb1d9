-- A place for notes about a part that the team can edit on the Edit Part form.
-- The import had put "Formerly J-010" and the K-034 duplicate note into
-- spec_changes_description, which means something else (why a specification
-- changed); they move here.
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS remarks text;
UPDATE public.parts
   SET remarks = spec_changes_description, spec_changes_description = NULL
 WHERE remarks IS NULL
   AND (spec_changes_description LIKE 'Formerly J-%' OR spec_changes_description LIKE 'DUPLICATE%');
