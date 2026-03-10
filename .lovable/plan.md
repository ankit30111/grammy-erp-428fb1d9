

# Wire Up Product Master to Supabase

## Current State vs Requirements

**Already exists in DB:**
- `dash_products` — has most fields but with different names (e.g. `barcode_ean` vs user's `ean_barcode`, `serial_prefix` vs `serial_no_prefix`). Missing some user-requested columns.
- `dash_product_documents` — exists but schema differs (has `is_current`/`version` as int; user wants `version` as text, `doc_type`, `doc_name`, `uploaded_by` as uuid FK).
- `dash_product_compliance` — exists with basic BIS fields; user wants expanded schema with label locations, branding, other certifications.
- `dash_product_spares` — junction table linking to `dash_spare_parts`. User wants a new `dash_product_spare_parts` table with inline part details.

**Does NOT exist — needs creation:**
- `dash_product_specs` (power_output, frequency_response, connectivity[], dimensions, weight, color_variants[], box_contents[], custom_specs)
- `dash_product_qc_checklist` (parameter_name, parameter_category, expected_value, is_mandatory, sort_order)
- `dash_product_spare_parts` (part_name, part_number, unit_cost, selling_price, current_stock, reorder_level)
- Storage bucket `dash-product-docs`

## Database Migration

### 1. Create `dash_product_specs`
New table with product_id FK, audio/connectivity/dimensions/weight fields, array columns for connectivity/color_variants/box_contents, custom_specs JSONB. RLS enabled.

### 2. Create `dash_product_qc_checklist`
New table with product_id FK, parameter_name, parameter_category (enum-like text), expected_value, is_mandatory, sort_order. RLS enabled.

### 3. Create `dash_product_spare_parts`
New standalone table (not a junction table) with product_id FK, part_name, part_number (unique), description, unit_cost, selling_price, current_stock, reorder_level. RLS enabled.

### 4. Alter `dash_product_compliance`
Add columns: `rating_label_location_product`, `rating_label_location_box`, `mrp_label_location_box`, `brand_logo_location`, `other_certifications` (jsonb), `compliance_notes`. Rename-safe approach: add new columns alongside existing ones.

### 5. Alter `dash_product_documents`
Add `doc_name` (text), `doc_type` (text) columns. Keep existing columns for backward compatibility.

### 6. Create `dash-product-docs` storage bucket
Public bucket for document uploads, with RLS policy for authenticated uploads.

### 7. RLS Policies
All new tables: authenticated users can SELECT. For INSERT/UPDATE/DELETE — since there's no `user_profiles` table with roles in this project (roles are on `user_accounts`), use authenticated access for all operations (matching existing DASH table patterns).

## Frontend Changes

### `src/hooks/useDashProducts.ts`
- Add `useDashProductSpecs` + `useDashProductSpecsMutations` hooks (CRUD for `dash_product_specs`)
- Add `useDashProductQCChecklist` + mutations hooks (CRUD for `dash_product_qc_checklist`)
- Add `useDashProductSpareParts` + mutations hooks (CRUD for `dash_product_spare_parts`)
- Update compliance hooks to handle new columns
- Update document hooks to use `dash-product-docs` bucket and new columns

### `src/components/Dash/ProductSpecsTab.tsx`
Rewrite to use `dash_product_specs` table instead of inline form fields. Add inputs for power_output, frequency_response, connectivity (multi-select/tag input), dimensions (L/W/H), weight, color_variants, box_contents, country_of_origin, custom_specs key-value editor.

### `src/components/Dash/ProductSparesTab.tsx`
Rewrite to use `dash_product_spare_parts` table. Show inline add form for new spare parts with part_name, part_number, costs, stock. Table view with edit/delete.

### `src/components/Dash/ProductDocumentsTab.tsx`
Update DOCUMENT_TYPES to match new doc_type values (user_manual, service_manual, firmware, box_design, rating_label, mrp_label, bis_certificate, branding_guide, other). Update upload to use `dash-product-docs` bucket.

### `src/components/Dash/ProductComplianceTab.tsx`
Add fields for rating_label_location_product, rating_label_location_box, mrp_label_location_box, brand_logo_location, other_certifications, compliance_notes.

### `src/components/Dash/ProductBasicInfoTab.tsx`
Minor — no structural changes needed, field names already map correctly to existing `dash_products` columns.

### `src/pages/dash/DashProducts.tsx`
Update form defaults and save logic to handle specs/QC as separate table saves (after product save).

## Implementation Order
1. Database migration (3 new tables + alter 2 existing + storage bucket + RLS)
2. Expand hooks for new tables
3. Rewrite Specs, Spares, Documents, Compliance tab components
4. Update DashProducts page save flow

