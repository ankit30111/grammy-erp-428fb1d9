-- Change a brand's two-letter code everywhere it is used: the brands master,
-- brand codes of finished goods (JA-006-AI -> JA-006-AW), brand versions of
-- printed parts and sub-assemblies (SA-006-AI -> SA-006-AW), part branding
-- ticks, brand BOM lines, R&D version lines marked for the brand, and
-- customers' brands. Parts keep their ids, so stock, orders and BOMs follow.
CREATE OR REPLACE FUNCTION public.brand_rename_code(p_old text, p_new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.brands; c uuid; v_new text := upper(btrim(p_new)); v_parts int; v_lines int; v_codes text[];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can change a brand code' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.brands WHERE letter = upper(btrim(p_old)) FOR UPDATE;
  IF b.letter IS NULL THEN RAISE EXCEPTION 'No brand %', p_old; END IF;
  IF v_new !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'A brand code is two letters, A-Z'; END IF;
  IF v_new = b.letter THEN RETURN jsonb_build_object('brand', b.name, 'code', v_new, 'parts', '[]'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM public.brands WHERE letter = v_new) THEN
    RAISE EXCEPTION '% is already %', v_new, (SELECT name FROM public.brands WHERE letter = v_new);
  END IF;
  IF EXISTS (SELECT 1 FROM public.parts WHERE brand = b.letter
              AND EXISTS (SELECT 1 FROM public.parts q WHERE q.part_code = regexp_replace(parts.part_code, '-' || b.letter || '$', '-' || v_new))) THEN
    RAISE EXCEPTION 'A part code ending in -% already exists', v_new;
  END IF;

  -- The new code takes over the name; the old row goes once nothing points at it.
  UPDATE public.brands SET name = name || ' [' || letter || ']' WHERE letter = b.letter;
  INSERT INTO public.brands (letter, name, is_active, created_at) VALUES (v_new, b.name, b.is_active, b.created_at);

  PERFORM set_config('app.brand_sync', 'on', true);
  PERFORM set_config('app.versioning', 'on', true);
  PERFORM set_config('app.approving', 'on', true);

  WITH u AS (
    UPDATE public.parts
       SET part_code = regexp_replace(part_code, '-' || b.letter || '$', '-' || v_new), brand = v_new
     WHERE brand = b.letter
    RETURNING part_code)
  SELECT count(*), array_agg(part_code ORDER BY part_code) INTO v_parts, v_codes FROM u;

  UPDATE public.part_brands SET brand = v_new WHERE brand = b.letter;
  UPDATE public.bom_brand_lines SET brand = v_new WHERE brand = b.letter;
  UPDATE public.customer_brands SET brand = v_new WHERE brand = b.letter;
  -- Renaming the old row above relabelled its customers for a moment; set them back.
  PERFORM public.customer_brand_names_refresh(customer_id) FROM public.customer_brands WHERE brand = v_new;
  UPDATE public.version_lines SET brands = array_replace(brands, b.letter, v_new) WHERE b.letter = ANY (brands);
  GET DIAGNOSTICS v_lines = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.parts WHERE brand = b.letter) THEN
    RAISE EXCEPTION 'Some parts still carry %', b.letter;
  END IF;
  DELETE FROM public.brands WHERE letter = b.letter;

  PERFORM set_config('app.brand_sync', 'off', true);
  PERFORM set_config('app.versioning', 'off', true);
  PERFORM set_config('app.approving', 'off', true);
  PERFORM public.sync_brand_variants();

  RETURN jsonb_build_object('brand', b.name, 'old', b.letter, 'code', v_new,
                            'parts', to_jsonb(coalesce(v_codes, '{}')), 'version_lines', v_lines);
END $$;
REVOKE ALL ON FUNCTION public.brand_rename_code(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.brand_rename_code(text, text) TO authenticated;

-- AIWA: AI -> AW.
DO $$ DECLARE r jsonb; BEGIN
  r := public.brand_rename_code('AI', 'AW');
  RAISE NOTICE 'AIWA renamed: %', r;
END $$;
