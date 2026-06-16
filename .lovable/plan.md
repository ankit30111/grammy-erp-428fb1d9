## Problem

Creating a purchase order fails with `function generate_po_number() does not exist`.

Two database functions, `public.set_po_number()` (the BEFORE INSERT trigger on `purchase_orders`) and `public.generate_po_number()`, were hardened with `SET search_path = ''` but their bodies still call/reference objects unqualified (`generate_po_number()`, `purchase_orders`). With an empty search_path those names cannot be resolved, so every PO insert errors out.

There are also two identical triggers (`trg_set_po_number` and `trigger_set_po_number`) firing the same function — harmless but redundant.

## Fix (single migration)

1. `CREATE OR REPLACE FUNCTION public.generate_po_number()` — same body, but reference `public.purchase_orders` explicitly.
2. `CREATE OR REPLACE FUNCTION public.set_po_number()` — call `public.generate_po_number()` explicitly.
3. Drop the duplicate trigger `trigger_set_po_number` on `public.purchase_orders`, keeping `trg_set_po_number`.

No frontend, RLS, or grant changes are needed — the PO insert payload from `useCreatePurchaseOrder` already sends `po_number: ''` so the trigger will populate it once the functions resolve.