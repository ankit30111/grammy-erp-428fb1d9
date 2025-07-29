-- Create test rejected GRN items for WhatsApp testing
-- First, update an existing GRN to link to our test vendor
UPDATE grn 
SET vendor_id = '1f293840-48cf-4b78-84ac-cc6ec52040f0'  -- Elin Electronics with WhatsApp 9810867133
WHERE id = '797af602-0201-41b8-91b7-af3193d572de';

-- Create a test GRN item with REJECTED status
INSERT INTO grn_items (
  grn_id, 
  raw_material_id, 
  po_quantity, 
  received_quantity, 
  accepted_quantity, 
  rejected_quantity, 
  iqc_status,
  iqc_completed_at,
  iqc_completed_by,
  whatsapp_notification_sent
) VALUES (
  '797af602-0201-41b8-91b7-af3193d572de',
  (SELECT id FROM raw_materials LIMIT 1),
  100,
  100,
  20,
  80,
  'REJECTED',
  now(),
  (SELECT id FROM auth.users LIMIT 1),
  false
);