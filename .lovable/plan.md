# Store Design System Step 2b

## Scope
- Rebuild the default Production Vouchers list with the existing shell `DataTable` and `StatePill`, preserving its current query and voucher-opening behavior.
- Remove redundant headings and static badges from the other Store tabs while retaining the existing live Production Feedback count in the main tab bar.
- Delete the unused Store dashboard header after confirming it has no consumers.
- Migrate all five legacy page-header consumers to the shell `PageHeader`, mapping `description` to `subtitle`, then delete the legacy header.
- Remove horizontal-scroll table wrappers throughout the Store module without changing data behavior.

## Production Voucher List
- Use five columns because no kit-readiness percentage currently exists: Voucher `116px`, Product `auto`, Qty `84px`, Plan date `96px`, Status `108px`.
- Fold customer and kit status into the expanded row details so no existing displayed field is lost.
- Keep row activation connected to the existing `onSelectVoucher(order.id)` callback.

## Technical Notes
- No database, query, hook, mutation, calculation, or business-rule changes.
- Do not modify `ProductionVoucherDetails.tsx` or any file under `src/components/shell/`.
- Validate with the project build, source scans for prohibited overflow classes, and a 1280px browser check where authentication permits.
