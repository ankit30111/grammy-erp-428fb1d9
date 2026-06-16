## Problem

On `/store`, receiving material **B-075** (Store Physical: 749, IQC Accepted: 750) produced an inventory quantity of **1499** — both received batches are being added together instead of the actual store-verified quantity.

## Root cause

Two AFTER UPDATE triggers on `public.grn_items` both write to `public.inventory` on the **same** UPDATE that the Store page performs (`store_confirmed=true` + `store_physical_quantity` set):

1. `trigger_update_inventory_from_grn` → calls `update_inventory_from_grn()` and adds `NEW.accepted_quantity` (750, from IQC).
2. `update_inventory_from_store_verification_trigger` → calls `update_inventory_from_store_verification()` and adds `NEW.store_physical_quantity` (749, the true received qty).

Both fire on the same row update, so inventory gets `750 + 749 = 1499`. The store-physical-verification quantity is the authoritative figure (per the existing flow, the store sometimes counts a different quantity than IQC accepted — that's exactly what produces `store_discrepancies`).

This also means every prior GRN with a discrepancy between IQC accepted and store physical has the same double-count bug in inventory.

## Fix

### 1. Migration

- **Drop** the legacy trigger `trigger_update_inventory_from_grn` on `public.grn_items`. Keep its function `update_inventory_from_grn()` defined (no callers) but unused, in case other environments still rely on it — safer to drop just the trigger.
- **Keep** `update_inventory_from_store_verification_trigger` as the single source that updates inventory from store receipts. It already:
  - adds `store_physical_quantity` once,
  - logs the movement via `log_material_movement`,
  - is plant-scoped via `grn.plant_id`.
- **Backfill correction** for B-075's existing row: subtract the duplicated `accepted_quantity` that was added by the legacy trigger for any historical GRN items where `store_confirmed = true` and inventory was double-credited.

  To stay safe and surgical, the migration will only adjust the one row the user reported (B-075 in plant `dfb1df59-…`) from 1499 → 749. A broader backfill across all historically double-counted items is risky without per-row review, so this migration leaves that to the existing **Manual Sync** button on `/store` (which already recomputes correct totals from `store_physical_quantity || accepted_quantity`). After the trigger is dropped, running Manual Sync once will reconcile every other affected material.

### 2. No frontend changes

The Store receipt code (`useGRNReceiving.handleConfirmReceipt`) already writes the right fields. The inventory query (`useInventoryQuery`) and Store dashboard render whatever inventory holds — once the trigger duplication is removed, the displayed quantity will be correct.

## Verification

After the migration:
1. Re-open `/store` → inventory tab for plant `dfb1df59-…` → confirm B-075 shows **749**.
2. Receive a fresh test GRN item (IQC accepted X, store physical Y where Y ≠ X) → confirm inventory increments by exactly **Y**, not X+Y.
3. Click **Sync Inventory** on `/store` → confirm "Processed N materials" corrects any remaining historical double-counts.

## Out of scope

- Removing the unused `update_inventory_from_grn()` function body (keeping for safety; can be dropped in a later cleanup).
- Auditing every historically double-counted material — Manual Sync handles it.
