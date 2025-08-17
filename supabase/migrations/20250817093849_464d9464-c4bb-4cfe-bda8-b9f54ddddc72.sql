
BEGIN;

-- Target the GRN by its number
WITH grn_target AS (
  SELECT id, grn_number, purchase_order_id
  FROM public.grn
  WHERE grn_number = 'GRN_08_20'
),
items AS (
  SELECT 
    gi.id,
    gi.raw_material_id,
    -- Use the physically verified quantity if present, else accepted qty (what impacted inventory/PO)
    COALESCE(gi.store_physical_quantity, gi.accepted_quantity, 0) AS qty
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

-- 1) Reverse inventory additions that happened due to this GRN
UPDATE public.inventory i
SET 
  quantity = GREATEST(i.quantity - a.qty, 0),
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

-- 3) Remove GRN-related material movement audit logs
DELETE FROM public.material_movements mm
USING grn_target g
WHERE mm.reference_type = 'GRN'
  AND (mm.reference_id = g.id OR mm.reference_number = g.grn_number);

-- 4) Remove store discrepancies linked to this GRN or its items
DELETE FROM public.store_discrepancies sd
USING grn_target g
WHERE sd.grn_id = g.id
   OR sd.grn_item_id IN (SELECT id FROM items);

-- 5) Remove IQC vendor CAPA records tied to items of this GRN
DELETE FROM public.iqc_vendor_capa ivc
WHERE ivc.grn_item_id IN (SELECT id FROM items);

-- 6) Remove GRN items
DELETE FROM public.grn_items gi
WHERE gi.grn_id IN (SELECT id FROM grn_target);

-- 7) Finally, remove the GRN itself
DELETE FROM public.grn g
WHERE g.id IN (SELECT id FROM grn_target);

COMMIT;
