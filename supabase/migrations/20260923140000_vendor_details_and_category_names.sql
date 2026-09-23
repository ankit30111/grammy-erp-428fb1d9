-- Applied with the import of Part Code 2025 Master and the Approved Supplier List (GE/PUR/001).
-- Category names now match the part list tabs: C Connector, Y Wires, O Common, L Speaker, R Remotes.

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.vendors.details IS 'Everything on the approved-supplier sheet the other columns do not hold: further emails and contacts, bank name, account holder, PAN, supplied category and area.';
UPDATE public.part_categories SET name = name || ' (tmp)' WHERE prefix IN ('C','Y');
UPDATE public.part_categories SET name = CASE prefix
  WHEN 'C' THEN 'Connector' WHEN 'Y' THEN 'Wires' WHEN 'O' THEN 'Common' WHEN 'L' THEN 'Speaker'
  WHEN 'R' THEN 'Remotes' WHEN 'E' THEN 'PCB' ELSE name END
 WHERE prefix IN ('C','Y','O','L','R','E');
