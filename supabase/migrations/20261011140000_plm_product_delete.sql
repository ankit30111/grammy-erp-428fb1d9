-- Deleting an R&D product from the R&D list, with the password asked again.
-- Management and Admin only. The product's model (JA-016) goes with it, so the
-- number can be used again - but only while nothing uses the model: no brand
-- codes, production, stock or BOMs. Otherwise it is refused and says why.

CREATE OR REPLACE FUNCTION public.plm_product_delete(p_product uuid, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  p public.plm_products; v_model public.parts; v_used text[]; v_codes text; v_ok boolean;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can delete an R&D product' USING ERRCODE = '42501';
  END IF;
  SELECT u.encrypted_password = extensions.crypt(COALESCE(p_password, ''), u.encrypted_password) INTO v_ok
    FROM auth.users u WHERE u.id = auth.uid();
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Wrong password' USING ERRCODE = '28P01';
  END IF;

  SELECT * INTO p FROM public.plm_products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That product no longer exists'; END IF;

  SELECT * INTO v_model FROM public.parts WHERE plm_product_id = p.id AND source_type = 'MODEL' FOR UPDATE;
  IF FOUND THEN
    SELECT string_agg(part_code, ', ' ORDER BY part_code) INTO v_codes FROM public.parts WHERE model_id = v_model.id;
    IF v_codes IS NOT NULL THEN
      RAISE EXCEPTION '% has brand codes (%). Delete those under Parts first.', p.product_code, v_codes;
    END IF;
    -- The model's own records go with it.
    DELETE FROM public.software_releases WHERE model_id = v_model.id;
    DELETE FROM public.part_brands WHERE part_id = v_model.id;
    DELETE FROM public.bom_brand_lines WHERE parent_part_id = v_model.id;
    DELETE FROM public.brand_sync_issues WHERE part_id = v_model.id;
    BEGIN
      DELETE FROM public.item_versions WHERE item_id = v_model.id;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'A version of % is used inside another product''s BOM, so it cannot be deleted', p.product_code;
    END;
    UPDATE public.plm_products SET based_on_part_id = NULL WHERE based_on_part_id = v_model.id;
    v_used := public.part_usage(v_model.id);
    IF array_length(v_used, 1) IS NOT NULL THEN
      RAISE EXCEPTION '% is in use: %. It cannot be deleted.', p.product_code, array_to_string(v_used, ', ');
    END IF;
    DELETE FROM public.bom WHERE parent_part_id = v_model.id;
    DELETE FROM public.part_vendors WHERE part_id = v_model.id;
    DELETE FROM public.part_specifications WHERE part_id = v_model.id;
    DELETE FROM public.bom_change_requests WHERE parent_part_id = v_model.id;
    DELETE FROM public.parts WHERE id = v_model.id;
    IF v_model.part_code ~ ('^' || v_model.category || '-[0-9]{3,}$') THEN
      INSERT INTO public.released_part_codes (part_code, prefix, seq, released_by)
      VALUES (v_model.part_code, v_model.category, (regexp_match(v_model.part_code, '-([0-9]+)'))[1]::int, auth.uid())
      ON CONFLICT (part_code) DO NOTHING;
    END IF;
  END IF;

  DELETE FROM public.plm_products WHERE id = p.id;   -- stages, gates, tests, issues and CRS go with it
  RETURN jsonb_build_object('product_code', p.product_code, 'model_deleted', v_model.id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.plm_product_delete(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plm_product_delete(uuid, text) TO authenticated;
