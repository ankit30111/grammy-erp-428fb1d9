# Store production voucher design-system upgrade

## Goal
Create four reusable shell primitives, then use them to simplify only the Store production-voucher detail experience. Existing fetching, calculations, mutations, PDF generation, refresh behavior, and navigation handlers remain unchanged.

## Implementation
1. **Add shared shell primitives**
   - `PageHeader`: breadcrumb links, title/subtitle, quiet metadata, and right-aligned actions without card chrome.
   - `TabBar`: controlled underline tabs using the existing `.pill-tabs` and `.pill-tab` classes, including optional alert counts.
   - `DataTable`: fixed-layout, seven-column-capable table with one flexible column, no horizontal scrolling, group bands, expandable detail rows, state stripes, truncation titles, and sticky totals.
   - `StatePill`: semantic success, warning, destructive, and idle state labels using existing tokens.

2. **De-nest the Store view**
   - Remove the outer card wrapper and redundant Store/production-voucher headings.
   - Keep the broader Store tabs functional, but use the new shared tab presentation.
   - When a voucher is open, show one detail `PageHeader` with `Store / Production Vouchers / voucher number`, one refresh action, and one relative sync indicator.

3. **Rebuild voucher details without business-logic changes**
   - Add the compact voucher identity strip and semantic status pill.
   - Transform the existing BOM rows into grouped `DataTable` rows.
   - Render exactly seven columns: Material, Description, Req., Stock, Sent → Recd., To send, Balance.
   - Move category, inventory/dispatch detail, pending quantities, and validation detail into expandable rows.
   - Preserve the existing quantity state and handlers while restyling inputs.
   - Add computed totals and the single pinned action bar while preserving dispatch, PDF, and navigation behavior.

## Technical details
- Exactly one table column uses `auto`; all others use the requested fixed pixel widths through `<colgroup>`.
- The first cell uses an inset state stripe so it consumes no width.
- Relative sync time is presentation-only and updates from the existing inventory refresh cycle.
- Existing Store query and mutation bodies will not be edited.
- Expected changes: four new files under `src/components/shell/`, plus `src/pages/Store.tsx`, `src/pages/store/StoreDashboard.tsx`, and `src/components/Store/ProductionVoucherDetails.tsx`.

## Verification
- Run the project build.
- Check diagnostics after the build.
- Use the live preview at 1280px to confirm the voucher detail has seven columns, no horizontal page/table overflow, one refresh control, one sync indicator, expandable rows, and working actions.
