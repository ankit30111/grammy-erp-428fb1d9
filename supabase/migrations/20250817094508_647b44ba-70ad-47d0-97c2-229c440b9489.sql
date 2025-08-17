
BEGIN;

-- Identify the target GRN and capture its items with quantities that could have impacted stock/POs
WITH grn_target AS (
  SELECT id, grn_number, purchase_order_id
  FROM public.grn
  WHERE trim(grn_number) = 'GRN_08_20'
),
items AS (
  SELECT 
    gi.id,
    gi.grn_id,
    gi.raw_material_id,
    -- Prefer store physical verification qty, else accepted, else received, else 0
    COALESCE(gi.store_physical_quantity, gi.accepted_quantity, gi.received_quantity, 0) AS qty
  FROM public.grn_items gi
  WHERE gi.grn_id IN (SELECT id FROM grn_target)
),
agg_qty AS (
  SELECT raw_material_id, SUM(qty) AS qty
  FROM items
  GROUP BY raw_material_id
),
po_ctx AS (
  SELECT purchase_order_id
  FROM grn_target
  WHERE purchase_order_id IS NOT NULL
)

-- 1) Reverse inventory increases resulting from this GRN
UPDATE public.inventory i
SET 
  quantity = GREATEST(COALESCE(i.quantity, 0) - a.qty, 0),
  last_updated = now()
FROM agg_qty a
WHERE i.raw_material_id = a.raw_material_id;

-- 2) Reverse PO received quantities if this GRN was tied to a PO
UPDATE public.purchase_order_items poi
SET 
  received_quantity = GREATEST(COALESCE(poi.received_quantity, 0) - a.qty, 0)
FROM po_ctx p
JOIN agg_qty a ON true
WHERE poi.purchase_order_id = p.purchase_order_id
  AND poi.raw_material_id = a.raw_material_id;

-- 3) Delete material movement logs referencing this GRN (by id or number)
DELETE FROM public.material_movements mm
USING grn_target g
WHERE mm.reference_type = 'GRN'
  AND (mm.reference_id = g.id OR trim(mm.reference_number) = trim(g.grn_number));

-- 4) Delete any store discrepancies linked to this GRN or its items
DELETE FROM public.store_discrepancies sd
USING grn_target g
WHERE sd.grn_id = g.id
   OR sd.grn_item_id IN (SELECT id FROM items);

-- 5) Delete IQC vendor CAPA rows for these items
DELETE FROM public.iqc_vendor_capa ivc
WHERE ivc.grn_item_id IN (SELECT id FROM items);

-- 6) Delete the GRN items
DELETE FROM public.grn_items gi
WHERE gi.grn_id IN (SELECT id FROM grn_target);

-- 7) Delete the GRN header
DELETE FROM public.grn g
WHERE g.id IN (SELECT id FROM grn_target);

COMMIT;
