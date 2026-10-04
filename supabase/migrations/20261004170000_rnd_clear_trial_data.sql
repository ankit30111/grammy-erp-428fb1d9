-- R&D starts empty for trials (4 Oct 2026). Only R&D's own data goes: the
-- products and everything under them. The checklist template stays.
-- Models keep their brands and versions; they just lose the R&D link.
UPDATE public.parts SET plm_product_id = NULL WHERE plm_product_id IS NOT NULL;

-- Models that existed only because of an R&D project: no brands, no BOM lines.
DELETE FROM public.parts m
 WHERE m.source_type = 'MODEL'
   AND NOT EXISTS (SELECT 1 FROM public.parts b WHERE b.model_id = m.id)
   AND NOT EXISTS (SELECT 1 FROM public.model_versions v WHERE v.model_id = m.id AND jsonb_array_length(v.lines) > 0);

DELETE FROM public.plm_issues;
DELETE FROM public.plm_tests;
DELETE FROM public.plm_bom_lines;
DELETE FROM public.plm_gates;
DELETE FROM public.plm_deliverables;
UPDATE public.plm_products SET based_on_id = NULL;
DELETE FROM public.plm_products;
SELECT setval('public.seq_plm_issue', 1, false);
