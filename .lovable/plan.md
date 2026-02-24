

# Product Master Module - Complete Implementation Plan

## Current State

The existing `dash_products` table has a basic schema: product_name, model_number, category, mrp, dealer_price, distributor_price, barcode_ean, warranty_period_months, status (Active/Discontinued), technical_specs (JSONB), description. The current page (`DashProducts.tsx`) is a simple CRUD table with a dialog form.

The requirements call for a significantly richer system with pricing auto-calculation, document management with versioning, spare parts linking, compliance tracking, serial number series, and specifications -- requiring new database tables and a complete page rebuild.

## Database Changes (Migration)

### 1. Alter `dash_products` table -- add new columns

```text
+ hsn_code (text, nullable)
+ purchase_price (numeric, default 0)
+ gst_percent (numeric, default 18)
+ nlc (numeric, default 0)  -- auto-calculated
+ dp (numeric, default 0)   -- auto-calculated
+ serial_prefix (text, nullable)
+ serial_next_number (integer, default 1)
+ gross_weight (numeric, nullable)
+ net_weight (numeric, nullable)
+ software_button_details (text, nullable)
+ branding_info (text, nullable)
+ qa_checklist (jsonb, nullable)
+ created_by (text, nullable)
+ updated_by (text, nullable)
```

Also update the `dash_product_status` enum to add: `Development`, `Ready for Production` (currently only has Active/Discontinued).

Update the `dash_product_category` enum to add: `Accessories` (currently missing from the enum).

### 2. Create `dash_product_documents` table

```text
id (uuid PK)
product_id (uuid FK → dash_products)
document_type (text: QSG, Box Design Artwork, MRP Label Artwork, BIS Documents, Rating Label, Product Images)
file_name (text)
file_url (text)
version (integer, default 1)
is_current (boolean, default true)
uploaded_by (text, nullable)
created_at (timestamptz)
```

### 3. Create `dash_product_spares` junction table

```text
id (uuid PK)
product_id (uuid FK → dash_products)
spare_id (uuid FK → dash_spare_parts)
created_at (timestamptz)
UNIQUE(product_id, spare_id)
```

### 4. Create `dash_product_compliance` table

```text
id (uuid PK)
product_id (uuid FK → dash_products)
bis_certificate_number (text)
bis_expiry_date (date)
compliance_status (text: Active, Expired, Pending)
notes (text, nullable)
created_at (timestamptz)
updated_at (timestamptz)
```

### 5. Database function for NLC/DP auto-calculation trigger

A trigger on `dash_products` INSERT/UPDATE that recalculates:
- NLC = (purchase_price * 1.10) * (1 + gst_percent/100)
- DP = (NLC * 1.10) * (1 + gst_percent/100)

### 6. RLS policies

All new tables: authenticated users can SELECT, INSERT, UPDATE. Standard pattern matching existing DASH tables.

## Frontend Changes

### Route
Keep existing `/dash/products` route (no change needed -- the sidebar already points to it).

### Page Rebuild: `src/pages/dash/DashProducts.tsx`

Complete rewrite with a tabbed layout at the top-level:

**List View** (default): Product table with search/filter by name, model, EAN, category, status. "+ Add Product" button opens the detail view.

**Detail/Edit View** (when adding or clicking a product): Multi-tab form:
- **[Basic Info]** -- Product name, Model number (combobox: dropdown from Grammy ERP `products` table + "Create New" option), Category, HSN Code, EAN/Barcode, MRP, SR No. Series (prefix + auto-increment display), Status, Description
- **[Pricing]** -- Purchase Price input, GST% input, auto-calculated NLC and DP shown as read-only with formula displayed
- **[Specs]** -- Technical Specs (textarea, rich text later), Gross Weight, Net Weight, QA Checklist (JSONB checklist builder), Software & Button Details, Branding Positioning & Size
- **[Spares]** -- Multi-select from `dash_spare_parts`, inline "Add New Spare" option, shows linked spares with remove ability
- **[Documents]** -- Upload sections for each document type (QSG, Box Design, MRP Label, BIS Docs, Rating Label, Product Images). Each shows version history, upload date, uploaded by. Upload to `dash-documents` storage bucket.
- **[Compliance]** -- BIS Certificate Number, BIS Expiry Date, Compliance Status. Shows alert if expiry is within 30 days.

**Save as Draft**: Status = "Development" on initial save.

**Export PDF**: Button to generate product profile PDF using existing jspdf dependency.

### New/Modified Files

| File | Action |
|------|--------|
| `supabase/migrations/...` | New migration for schema changes |
| `src/hooks/useDashProducts.ts` | Expand with pricing hooks, document CRUD, spares linking, compliance CRUD |
| `src/pages/dash/DashProducts.tsx` | Complete rewrite -- list view + tabbed detail view |
| `src/components/Dash/ProductBasicInfoTab.tsx` | Create -- Basic Info form tab |
| `src/components/Dash/ProductPricingTab.tsx` | Create -- Pricing with auto-calc display |
| `src/components/Dash/ProductSpecsTab.tsx` | Create -- Specifications form tab |
| `src/components/Dash/ProductSparesTab.tsx` | Create -- Spares linking tab |
| `src/components/Dash/ProductDocumentsTab.tsx` | Create -- Document upload/versioning tab |
| `src/components/Dash/ProductComplianceTab.tsx` | Create -- Compliance & regulatory tab |
| `src/components/Dash/ProductListView.tsx` | Create -- Main product list with filters |

### Pricing Auto-Calculation Logic (Frontend)

When user types purchase_price or gst_percent:
```text
NLC = (purchase_price × 1.10) × (1 + gst_percent / 100)
DP  = (NLC × 1.10) × (1 + gst_percent / 100)
```
Display formula text below each field (non-editable). Values update live as user types. Saved to DB on submit. Backend trigger also recalculates as safety net.

### Model Number Dropdown

Uses a combobox that fetches from the Grammy ERP `products` table for existing model numbers. Includes a "+ Create New Model" option at the bottom. If selected, shows inline inputs for the new model and saves to the ERP `products` table first, then uses the model number in the DASH product.

### Document Versioning

When uploading a replacement document for the same type:
1. Set `is_current = false` on the existing document record
2. Insert new record with `version = previous_version + 1`, `is_current = true`
3. Old files remain in storage for history

### Implementation Order

1. Database migration (alter table + 3 new tables + trigger + RLS)
2. Expand hooks (`useDashProducts.ts`)
3. Build all 6 tab components
4. Build `ProductListView` component
5. Rewrite `DashProducts.tsx` page with list/detail views

