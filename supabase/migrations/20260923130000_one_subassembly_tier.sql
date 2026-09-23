-- Semi-finished and sub-assembled goods are one tier: Sub-assembly.
-- Both are built here, stocked, and used inside other parts. No category used
-- SEMI_FINISHED when this ran; any that did would be folded in first.
UPDATE public.part_categories SET tier = 'SUB_ASSEMBLED' WHERE tier = 'SEMI_FINISHED';
ALTER TABLE public.part_categories DROP CONSTRAINT IF EXISTS part_categories_tier_known;
ALTER TABLE public.part_categories ADD CONSTRAINT part_categories_tier_known
  CHECK (tier = ANY (ARRAY['PURCHASE', 'SUB_ASSEMBLED', 'FINISHED']));
