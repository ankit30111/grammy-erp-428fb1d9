
-- Add implementation tracking fields to existing CAPA tables
ALTER TABLE iqc_vendor_capa 
ADD COLUMN IF NOT EXISTS implementation_assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS implementation_deadline date,
ADD COLUMN IF NOT EXISTS implementation_status text DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS implementation_remarks text,
ADD COLUMN IF NOT EXISTS implementation_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS implementation_completed_by uuid REFERENCES auth.users(id);

ALTER TABLE production_capa 
ADD COLUMN IF NOT EXISTS implementation_assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS implementation_deadline date,
ADD COLUMN IF NOT EXISTS implementation_status text DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS implementation_remarks text,
ADD COLUMN IF NOT EXISTS implementation_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS implementation_completed_by uuid REFERENCES auth.users(id);

-- Create a view to aggregate all CAPA approvals
CREATE OR REPLACE VIEW capa_approvals_view AS
SELECT 
  'VENDOR' as capa_category,
  iqc.id,
  iqc.grn_item_id as reference_id,
  rm.name as part_or_process,
  iqc.capa_document_url,
  iqc.capa_status as status,
  iqc.received_at as submitted_at,
  iqc.initiated_by as submitted_by,
  iqc.remarks,
  v.name as vendor_name,
  iqc.created_at,
  iqc.approved_at,
  iqc.approved_by,
  iqc.implementation_assigned_to,
  iqc.implementation_deadline,
  iqc.implementation_status,
  iqc.implementation_remarks,
  iqc.implementation_completed_at,
  iqc.implementation_completed_by
FROM iqc_vendor_capa iqc
JOIN grn_items gi ON iqc.grn_item_id = gi.id
JOIN raw_materials rm ON gi.raw_material_id = rm.id
JOIN vendors v ON iqc.vendor_id = v.id

UNION ALL

SELECT 
  'PRODUCTION' as capa_category,
  pc.id,
  pc.production_order_id as reference_id,
  p.name as part_or_process,
  pc.capa_document_url,
  pc.capa_status as status,
  pc.received_at as submitted_at,
  pc.initiated_by as submitted_by,
  pc.remarks,
  NULL as vendor_name,
  pc.created_at,
  pc.approved_at,
  pc.approved_by,
  pc.implementation_assigned_to,
  pc.implementation_deadline,
  pc.implementation_status,
  pc.implementation_remarks,
  pc.implementation_completed_at,
  pc.implementation_completed_by
FROM production_capa pc
JOIN production_orders po ON pc.production_order_id = po.id
JOIN products p ON po.product_id = p.id

UNION ALL

SELECT 
  'LINE_REJECTION' as capa_category,
  rca.id,
  rca.line_rejection_id as reference_id,
  rm.name as part_or_process,
  rca.rca_file_url as capa_document_url,
  rca.approval_status as status,
  rca.created_at as submitted_at,
  rca.uploaded_by as submitted_by,
  rca.rejection_reason as remarks,
  NULL as vendor_name,
  rca.created_at,
  rca.approved_at,
  rca.approved_by,
  NULL as implementation_assigned_to,
  NULL as implementation_deadline,
  'PENDING' as implementation_status,
  NULL as implementation_remarks,
  NULL as implementation_completed_at,
  NULL as implementation_completed_by
FROM rca_reports rca
JOIN line_rejections lr ON rca.line_rejection_id = lr.id
JOIN raw_materials rm ON lr.raw_material_id = rm.id

UNION ALL

SELECT 
  'PART_ANALYSIS' as capa_category,
  ccp.id,
  ccp.complaint_id as reference_id,
  rm.name as part_or_process,
  ccp.capa_document_url,
  CASE 
    WHEN ccp.capa_document_url IS NOT NULL AND ccp.status = 'PENDING' THEN 'RECEIVED'
    WHEN ccp.status = 'CLOSED' THEN 'APPROVED'
    ELSE 'AWAITED'
  END as status,
  ccp.created_at as submitted_at,
  ccp.analyzed_by as submitted_by,
  ccp.remarks,
  NULL as vendor_name,
  ccp.created_at,
  ccp.closed_at as approved_at,
  ccp.closed_by as approved_by,
  NULL as implementation_assigned_to,
  NULL as implementation_deadline,
  'PENDING' as implementation_status,
  NULL as implementation_remarks,
  NULL as implementation_completed_at,
  NULL as implementation_completed_by
FROM customer_complaint_parts ccp
JOIN raw_materials rm ON ccp.raw_material_id = rm.id
WHERE ccp.capa_document_url IS NOT NULL;
