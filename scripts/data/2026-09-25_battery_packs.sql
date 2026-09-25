-- Battery packs: O codes kept, built in-house, standard names, BOMs from Book3.xlsx
-- (checked 25 Sep 2026; see "Battery BOM check.xlsx"). Runs as one transaction:
-- if any code is missing, nothing is changed and the missing codes are listed.
DO $$
DECLARE
  v_missing text; v_single text; v_single_id uuid; r record;
  need text[] := ARRAY['O-057','O-059','O-073','O-076','O-081','O-018','O-047','D-004','D-060','D-082','D-083',
                       'D-084','D-085','D-086','D-087','D-088','E-145','E-174','E-187','S-324','S-326','P-471',
                       'Y-094','Y-106','Y-112','Y-178'];
BEGIN
  SELECT string_agg(c, ', ') INTO v_missing FROM unnest(need) c
   WHERE NOT EXISTS (SELECT 1 FROM public.parts WHERE part_code = c);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Missing part codes, nothing loaded: %', v_missing; END IF;

  -- O-057 is the 2000 mAh cell (as the part master has it). The single-cell pack
  -- gets the next O code.
  v_single := public.next_part_code('O');
  INSERT INTO public.parts (part_code, name, category, uom, made_in_house, remarks)
  VALUES (v_single, 'BATTERY PACK 3.7V 2000MAH (1 CELL)', 'O', 'PCS', true,
          'Single-cell pack. Was listed under O-057, which is the 2000 mAh cell.')
  RETURNING id INTO v_single_id;

  UPDATE public.parts p SET name = v.name, made_in_house = true
    FROM (VALUES ('O-059', 'BATTERY PACK 3.7V 4000MAH (2 CELL, 1S2P)'),
                 ('O-073', 'BATTERY PACK 7.4V 6000MAH (6 CELL, 2S3P)'),
                 ('O-076', 'BATTERY PACK 11.1V 8000MAH (12 CELL, 3S4P)'),
                 ('O-081', 'BATTERY PACK 7.4V 4000MAH (4 CELL, 2S2P)')) v(code, name)
   WHERE p.part_code = v.code;

  -- Parts the BOMs count in millimetres are stocked in MM.
  UPDATE public.parts SET uom = 'MM'
   WHERE part_code IN ('D-060','D-082','D-083','D-084','D-085','D-086','D-087','D-088','P-471','O-047');

  -- pack, child, qps (NULL = bulk)
  CREATE TEMP TABLE _lines (pack text, child text, qps numeric) ON COMMIT DROP;
  INSERT INTO _lines VALUES
   ('O-073','D-004',NULL),('O-073','D-060',200),('O-073','E-174',1),('O-073','D-082',198),('O-073','D-085',110),
   ('O-073','S-324',12),('O-073','D-087',18),('O-073','S-326',1),('O-073','O-057',6),('O-073','Y-094',1),
   ('O-081','D-004',NULL),('O-081','D-060',150),('O-081','E-174',1),('O-081','D-082',110),('O-081','D-083',110),
   ('O-081','S-324',8),('O-081','D-087',18),('O-081','S-326',1),('O-081','O-018',4),('O-081','Y-112',1),
   ('O-076','D-004',NULL),('O-076','D-060',300),('O-076','E-187',1),('O-076','D-082',416),('O-076','D-084',140),
   ('O-076','S-324',24),('O-076','D-088',156),('O-076','S-326',1),('O-076','P-471',55),('O-076','O-057',12),
   ('O-076','Y-106',1),
   ('O-059','O-018',2),('O-059','D-082',44),('O-059','D-086',85),('O-059','S-324',4),('O-059','Y-178',1),
   ('O-059','E-145',1),('O-059','S-326',1),('O-059','D-060',80),('O-059','D-004',NULL),
   ('SINGLE','O-057',1),('SINGLE','O-047',110),('SINGLE','S-324',2),('SINGLE','Y-178',1),('SINGLE','E-145',1),
   ('SINGLE','S-326',1),('SINGLE','D-004',NULL);

  FOR r IN SELECT DISTINCT pack FROM _lines LOOP
    PERFORM public.apply_bom(
      CASE WHEN r.pack = 'SINGLE' THEN v_single_id ELSE (SELECT id FROM public.parts WHERE part_code = r.pack) END,
      (SELECT jsonb_agg(jsonb_build_object(
                'child_part_id', c.id, 'quantity', l.qps, 'uom', c.uom, 'bulk', l.qps IS NULL))
         FROM _lines l JOIN public.parts c ON c.part_code = l.child WHERE l.pack = r.pack));
  END LOOP;
  RAISE NOTICE 'Single-cell pack created as %', v_single;
END $$;
