-- Semi-finished goods are stocked, and everything Grammy builds gets a CIR and a PQC.
--
-- I had semi-finished mapped to ASSEMBLED_INLINE - built on the line, consumed
-- there, never held. Ankit corrected it: a batch of semi-finished goods is built
-- ahead of a plan that is known to be coming, issued a few at a time, brought
-- back and put into the store. That is a part with its own stock balance, which
-- is ASSEMBLED_STOCKED. The difference is not cosmetic: the shortage calculator
-- consumes an ASSEMBLED_STOCKED part's stock before exploding its bill, and
-- explodes straight through an ASSEMBLED_INLINE one as if none could exist. Left
-- wrong, planning would have bought raw material for semi-finished goods already
-- sitting in the store.
--
-- So semi-finished and sub-assembled now behave identically in the ledger. They
-- are still two different things on the floor, and the names are still being
-- settled inside Grammy, so the distinction is held where a naming decision can
-- change it without touching the ledger: a tier on the category.
--
--     tier              what the floor calls it        how the ledger treats it
--     PURCHASE          purchase part                  PURCHASED
--     SEMI_FINISHED     semi-finished good             ASSEMBLED_STOCKED
--     SUB_ASSEMBLED     sub-assembled good             ASSEMBLED_STOCKED
--     FINISHED          finished good                  FINISHED_GOOD
--
-- `kind` becomes a generated column off `tier`, so the two cannot be set to
-- different things. When the nomenclature discussion lands, the tier list is what
-- changes; nothing in stock, planning or the ledger has to move.

-- ---------------------------------------------------------------------------
-- The CIR sheet
-- ---------------------------------------------------------------------------
-- A purchased part carries a specification sheet and an IQC checklist, because it
-- is inspected on arrival. A part Grammy builds is inspected as it is made, so it
-- carries a CIR sheet and a PQC checklist instead. There was nowhere to put the
-- CIR: the table has iqc_, pqc_, oqc_, ccl_ and crs_ but no cir_. (crs_url is the
-- BIS Compulsory Registration Scheme certificate - a different document that
-- happens to look like an abbreviation of this one.)
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS cir_sheet_url text;

COMMENT ON COLUMN public.parts.cir_sheet_url IS
  'CIR sheet for a part Grammy builds. The made-here counterpart of specification_sheet_url on a purchased part.';

-- ---------------------------------------------------------------------------
-- Tier on the category
-- ---------------------------------------------------------------------------
ALTER TABLE public.part_categories ADD COLUMN IF NOT EXISTS tier text;

UPDATE public.part_categories
   SET tier = CASE kind
     WHEN 'PURCHASED'         THEN 'PURCHASE'
     WHEN 'FINISHED_GOOD'     THEN 'FINISHED'
     WHEN 'ASSEMBLED_INLINE'  THEN 'SEMI_FINISHED'
     ELSE 'SUB_ASSEMBLED'
   END
 WHERE tier IS NULL;

ALTER TABLE public.part_categories
  ALTER COLUMN tier SET NOT NULL,
  ADD CONSTRAINT part_categories_tier_known
    CHECK (tier IN ('PURCHASE', 'SEMI_FINISHED', 'SUB_ASSEMBLED', 'FINISHED'));

-- kind is now derived, not stored twice. A generated column is the only version
-- of "derived" the database enforces - a trigger can be bypassed by a direct
-- UPDATE, and a convention in the app cannot survive a second screen.
ALTER TABLE public.part_categories DROP COLUMN kind;

ALTER TABLE public.part_categories
  ADD COLUMN kind public.part_source_type
  GENERATED ALWAYS AS (
    CASE tier
      WHEN 'PURCHASE' THEN 'PURCHASED'::public.part_source_type
      WHEN 'FINISHED' THEN 'FINISHED_GOOD'::public.part_source_type
      ELSE 'ASSEMBLED_STOCKED'::public.part_source_type
    END
  ) STORED;

COMMENT ON COLUMN public.part_categories.tier IS
  'What the floor calls this kind of part. The names may change; the ledger behaviour is read from it, not stored beside it.';
COMMENT ON COLUMN public.part_categories.kind IS
  'How the ledger treats parts in this category. Derived from tier - semi-finished and sub-assembled are both stocked.';

-- Any part already carrying the inline type moves with its category. There is
-- exactly one non-purchased part today, and it is a finished good, so this is a
-- guard rather than a repair - but a migration that only works on today's data is
-- a migration that fails the day somebody imports a batch.
UPDATE public.parts p
   SET source_type = pc.kind
  FROM public.part_categories pc
 WHERE pc.prefix = p.category AND p.source_type IS DISTINCT FROM pc.kind;
