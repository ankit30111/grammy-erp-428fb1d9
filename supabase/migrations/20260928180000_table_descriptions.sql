-- Describe every table, grouped by area, so the Supabase table list and any
-- trace can be read without the code. Format: "[Area] what one row is. Notes."
-- Also drops five part columns that were never filled and nothing reads.

ALTER TABLE public.parts
  DROP COLUMN IF EXISTS spec_changes_description,
  DROP COLUMN IF EXISTS bom_url,
  DROP COLUMN IF EXISTS wi_url,
  DROP COLUMN IF EXISTS ccl_url,
  DROP COLUMN IF EXISTS crs_url;

-- Access & people
COMMENT ON TABLE public.plants IS '[Access] A factory / legal entity. Everything with plant_id belongs to one.';
COMMENT ON TABLE public.departments IS '[Access] A department (Management, R&D, Store...). Rights come from department membership.';
COMMENT ON TABLE public.department_permissions IS '[Access] Which app module a department may open.';
COMMENT ON TABLE public.user_accounts IS '[Access] A person who can sign in (mirror of auth.users) with role and default plant.';
COMMENT ON TABLE public.user_departments IS '[Access] User x department. Drives can_approve / can_edit_masters / has_role.';
COMMENT ON TABLE public.user_plants IS '[Access] User x plant. Drives in_plant() on every plant-scoped table.';
COMMENT ON TABLE public.approval_workflows IS '[Access] Legacy generic approval records (masters use approval_status on the row itself).';
COMMENT ON TABLE public.audit_logs IS '[Access] Who changed what and when, written by audit_state_transition triggers.';

-- Masters
COMMENT ON TABLE public.part_categories IS '[Masters] Part-code prefix registry (P, E, SA, JA...) and the tier each belongs to.';
COMMENT ON TABLE public.parts IS '[Masters] Every part code: purchased parts, sub-assemblies, finished goods and brand versions (branded_from).';
COMMENT ON TABLE public.released_part_codes IS '[Masters] Codes freed by deleting unused parts, handed out again by next_part_code.';
COMMENT ON TABLE public.brands IS '[Masters] Two-letter brand codes (PH, CR...) used in finished-good codes and brand versions.';
COMMENT ON TABLE public.part_brands IS '[Masters] Printed part x brand it is printed for (the Branding tick). Drives sync_brand_variants.';
COMMENT ON TABLE public.brand_sync_issues IS '[Masters] What the last branding sync could not line up. Rebuilt on every sync.';
COMMENT ON TABLE public.bom IS '[Masters] One line of a bill of materials: parent part contains child part x quantity. Written only through apply_bom.';
COMMENT ON TABLE public.bom_change_requests IS '[Masters] A BOM change by R&D waiting for Management approval.';
COMMENT ON TABLE public.part_vendors IS '[Masters] Approved vendor for a part (one may be primary).';
COMMENT ON TABLE public.part_specifications IS '[Masters] Versioned specification / IQC documents of a part.';
COMMENT ON TABLE public.vendors IS '[Masters] Supplier master. Bank and PAN readable only via get_vendor_finance.';
COMMENT ON TABLE public.vendor_contacts IS '[Masters] Extra contact people at a vendor.';
COMMENT ON TABLE public.customers IS '[Masters] Customer master.';
COMMENT ON TABLE public.customer_warehouses IS '[Masters] Ship-to addresses of a customer.';
COMMENT ON TABLE public.document_counters IS '[Masters] Running counters for document numbers (PO series).';

-- Planning & production
COMMENT ON TABLE public.projections IS '[Planning] Customer demand: finished good x quantity x month. Scheduled/vouchered/produced totals kept by trigger.';
COMMENT ON TABLE public.production_schedules IS '[Planning] A planned build on a date. One per voucher. Finished goods need a projection; sub-assemblies do not.';
COMMENT ON TABLE public.production_orders IS '[Production] The production voucher (PV-...). parent_order_id = the voucher a sub-assembly is built for.';
COMMENT ON TABLE public.production_order_lines IS '[Production] Which production line(s) a voucher runs on.';
COMMENT ON TABLE public.production_lines IS '[Production] A production line or sub-assembly cell of a plant.';
COMMENT ON TABLE public.hourly_production IS '[Production] Hourly output report of a voucher; sums into production_orders.produced_quantity.';
COMMENT ON TABLE public.serial_number_assignments IS '[Production] Serial number ranges given to a voucher.';
COMMENT ON TABLE public.shortages IS '[Planning] Material shortages computed from projections, for Purchase.';
COMMENT ON TABLE public.pqc_reports IS '[Quality] In-process (PQC) inspection report of a voucher.';
COMMENT ON TABLE public.line_rejections IS '[Quality] Parts rejected on the line during production.';

-- Store & stock
COMMENT ON TABLE public.stock_locations IS '[Stock] MAIN / QUAR / REJECT store of a plant.';
COMMENT ON TABLE public.stock_ledger IS '[Stock] Every stock movement, append-only. The single source of truth for quantities.';
COMMENT ON TABLE public.stock_balance IS '[Stock] Current quantity per part and location, kept equal to the ledger sum by trigger.';
COMMENT ON TABLE public.stock_holds IS '[Stock] Stock reserved for a voucher until its kit is issued (sync_voucher_holds).';
COMMENT ON TABLE public.kit_preparation IS '[Stock] The kit the store sends to production for a voucher.';
COMMENT ON TABLE public.kit_items IS '[Stock] One part in a kit: issued by store, received (counted) by production.';
COMMENT ON TABLE public.kit_feedback IS '[Stock] A difference production found in a kit, for the store to accept or reject.';
COMMENT ON TABLE public.kit_returns IS '[Stock] Parts returned from the line to the store against a kit item.';
COMMENT ON TABLE public.material_requests IS '[Stock] Extra material asked for by production outside the kit.';
COMMENT ON TABLE public.material_movement_log IS '[Stock] Legacy log of material requests (log_material_movement).';
COMMENT ON TABLE public.finished_goods_inventory IS '[Stock] Finished goods booked in after OQC, one lot per voucher.';

-- Purchase & receiving
COMMENT ON TABLE public.purchase_orders IS '[Purchase] A purchase order to a vendor.';
COMMENT ON TABLE public.purchase_order_items IS '[Purchase] One part on a PO; received quantity kept by trigger from GRNs.';
COMMENT ON TABLE public.grn IS '[Purchase] Goods received note: a delivery against a PO or without one.';
COMMENT ON TABLE public.grn_items IS '[Purchase] One part received on a GRN, with IQC outcome.';
COMMENT ON TABLE public.grn_variance_resolutions IS '[Purchase] How a store receiving difference was resolved.';
COMMENT ON TABLE public.import_containers IS '[Purchase] An import container and its shipping milestones.';
COMMENT ON TABLE public.container_materials IS '[Purchase] Parts packed in an import container.';

-- Quality
COMMENT ON TABLE public.capa IS '[Quality] Corrective / preventive action, internal or against a vendor.';
COMMENT ON TABLE public.vendor_notifications IS '[Quality] Quality-claim mail to a vendor (sent by the send-vendor-notifications function).';
COMMENT ON TABLE public.customer_complaints IS '[Quality] A complaint from a customer.';
COMMENT ON TABLE public.customer_complaint_parts IS '[Quality] Parts involved in a customer complaint.';
COMMENT ON TABLE public.rca_reports IS '[Quality] Root-cause analysis report.';

-- Sales & dispatch
COMMENT ON TABLE public.dispatch_orders IS '[Sales] A dispatch of finished goods to a customer.';
COMMENT ON TABLE public.dispatch_order_items IS '[Sales] Finished-goods lots on a dispatch.';
COMMENT ON TABLE public.spare_orders IS '[Sales] An order for spare parts.';
COMMENT ON TABLE public.spare_order_items IS '[Sales] One part on a spare order.';

-- R&D
COMMENT ON TABLE public.npd_projects IS '[R&D] A new product development project.';
COMMENT ON TABLE public.npd_bom_materials IS '[R&D] Draft BOM lines of an NPD project (before it becomes a part).';
COMMENT ON TABLE public.npd_benchmarks IS '[R&D] Competitor benchmarks of an NPD project.';
COMMENT ON TABLE public.npd_sample_tracking IS '[R&D] Samples sent / received for an NPD project.';

-- HR
COMMENT ON TABLE public.employees IS '[HR] An employee.';
COMMENT ON TABLE public.attendance IS '[HR] Daily attendance of an employee.';
COMMENT ON TABLE public.payroll IS '[HR] Monthly payroll of an employee.';
COMMENT ON TABLE public.performance_reviews IS '[HR] Performance review of an employee.';
COMMENT ON TABLE public.skills IS '[HR] Skill catalogue.';
COMMENT ON TABLE public.employee_skills IS '[HR] Employee x skill with level.';
COMMENT ON TABLE public.training_programs IS '[HR] A training programme.';
COMMENT ON TABLE public.employee_training IS '[HR] Employee x training attended.';
