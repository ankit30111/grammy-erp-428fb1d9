

# Enhanced DASH Customer Management

## Current State
The `dash_customers` table has basic fields: customer_name, customer_type, gst_number, credit_limit, contact_person, phone, email, address, city, state, territory, assigned_sales_manager, outstanding_balance, is_active. Missing many fields the user needs.

## Database Changes (Migration)

**Alter `dash_customers`** — add columns:
- `owner_name` (text) — business owner
- `owner_phone` (text)
- `primary_address` (text) — registered/primary address
- `godown_address` (text) — warehouse/godown address
- `pincode` (text)
- `pan_number` (text)
- `msme_certificate_url` (text) — file URL in storage
- `msme_number` (text)
- `cancelled_cheque_url` (text) — file URL in storage
- `gst_certificate_url` (text) — file URL in storage
- `bank_name` (text)
- `bank_account_number` (text)
- `bank_ifsc` (text)
- `salesman_name` (text) — field salesman assigned
- `notes` (text)
- `created_by` (text)
- `updated_by` (text)

**Create `dash_customer_documents` table** for versioned document uploads:
- `id` (uuid PK)
- `customer_id` (uuid FK → dash_customers)
- `document_type` (text: GST Certificate, MSME Certificate, Cancelled Cheque, PAN Card, Other)
- `file_name` (text)
- `file_url` (text)
- `uploaded_by` (text)
- `created_at` (timestamptz)

RLS: authenticated users can SELECT, INSERT, UPDATE, DELETE.

## Frontend Changes

### Rewrite `src/pages/dash/DashCustomers.tsx`
Replace simple dialog with a **list + detail view** pattern (same as Product Master):

**List View**: Table with search by name/GST/phone/territory, filter by type & status. Columns: Name, Type, GST, Territory, Credit Limit, Outstanding, Salesman, Status, Actions.

**Detail/Edit View** (tabbed form when adding/editing):

**[Basic Info]** tab:
- Customer Name, Customer Type (dropdown), Owner Name, Owner Phone, Contact Person, Phone, Email, Territory, Salesman Name, Assigned Sales Manager, Credit Limit, Status (Active/Inactive)

**[Address]** tab:
- Primary Address, City, State, Pincode, Godown Address

**[Documents & KYC]** tab:
- GST Number + GST Certificate upload
- PAN Number
- MSME Number + MSME Certificate upload
- Cancelled Cheque upload
- Bank Name, Account Number, IFSC
- Each upload shows file name, upload date, with replace capability

**[Notes & History]** tab:
- Notes textarea
- Outstanding balance (read-only)
- Created by / Updated by / timestamps

### Files to create/modify:
| File | Action |
|------|--------|
| Migration | Alter dash_customers + create dash_customer_documents |
| `src/hooks/useDashCustomers.ts` | Expand with document hooks |
| `src/pages/dash/DashCustomers.tsx` | Complete rewrite with list+detail tabbed view |
| `src/components/Dash/CustomerBasicInfoTab.tsx` | Create |
| `src/components/Dash/CustomerAddressTab.tsx` | Create |
| `src/components/Dash/CustomerDocumentsTab.tsx` | Create — uploads to `dash-documents` bucket |
| `src/components/Dash/CustomerNotesTab.tsx` | Create |
| `src/components/Dash/CustomerListView.tsx` | Create — searchable/filterable list |

