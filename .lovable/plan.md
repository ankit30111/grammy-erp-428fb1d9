## Goal

Today's Plants Management page (`/settings/plants`, linked from Settings) only stores `code`, `name`, `is_active`. You want to manage richer "factory" details — address, contact, regulatory info — for Grammy Electronics, Grammy Acoustics, and any future plant you add.

## What changes

### 1. Database — extend `public.plants`

One migration adding nullable columns (safe for existing rows):

- `address_line1` text
- `address_line2` text
- `city` text
- `state` text
- `postal_code` text
- `country` text (default `'India'`)
- `phone` text
- `email` text
- `gstin` text
- `factory_license_no` text
- `notes` text
- `updated_at` timestamptz default `now()` + trigger using existing `public.update_updated_at_column()`

RLS already exists on `plants`; no policy changes needed since the page is admin-only via `AdminGuard` and writes go through authenticated admin sessions. Confirm `admin write` / `authenticated read` policies cover the new columns (they do — policies are row-level, not column-level).

### 2. Page — `src/pages/PlantsManagement.tsx`

Redesign as a richer management screen:

- **List view** — cards (not just a table) for each plant showing:
  - Code badge, name, active/inactive status
  - Address block (line1, line2, city/state/postal, country)
  - Contact row (phone, email)
  - Regulatory row (GSTIN, factory license)
  - Edit button (top-right of card)
  - "Add plant" button stays in page header

- **Add plant dialog** — tabs or sections:
  - Basics: code (uppercase, immutable), name, active
  - Address: line1, line2, city, state, postal_code, country
  - Contact: phone, email
  - Regulatory: gstin, factory_license_no
  - Notes: free text

- **Edit plant dialog** — same fields as Add, but `code` locked. All other fields editable including active toggle.

- Validation: code + name required; everything else optional. GSTIN format hint only (no hard validation).

### 3. Settings entry

Already linked from `src/pages/Settings.tsx`. Update its description from generic copy to "Manage manufacturing plants — address, contact, GST, license" so it's discoverable.

### 4. Plant switcher (header)

No change to the switcher itself — it still shows code + name. The expanded details are only relevant on the management page.

## Out of scope

- No changes to Phase C plant-scoped queries / hooks.
- No NOT NULL on `plant_id` yet (still Phase D).
- No hard delete of plants — deactivate via `is_active` toggle remains the rule (plants are referenced by 14 plant-scoped tables).

## Files touched

- New migration: add columns + updated_at trigger to `public.plants`
- `src/pages/PlantsManagement.tsx` — redesigned list + dialogs
- `src/pages/Settings.tsx` — refreshed description text

Confirm and I'll implement.
