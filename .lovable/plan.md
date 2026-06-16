## Root cause (short version)

Per project rule, every DB function is created with `SET search_path TO ''` so it can't accidentally resolve to a malicious object. The cost of that rule: **every identifier inside the function body must be schema-qualified** (`public.foo`, `nextval('public.foo_seq')`). When a function forgets the `public.` prefix, it works in isolation (because the dev's session has `public` on the path) but blows up the moment it's invoked by another `search_path=''` function or trigger — exactly what just happened with `set_kit_number()` calling `generate_kit_number()`.

A scan of the database found this same latent bug in three places:

| Function | Bad call | Will break |
|---|---|---|
| `public.generate_kit_number` | `nextval('kit_number_seq')` | kit creation on dispatch (today's bug) |
| `public.generate_dispatch_order_number` | `nextval('dispatch_order_seq')` | first dispatch order creation |
| `public.generate_spare_order_number` | `nextval('spare_order_seq')` | first spare order creation |

Plus the trigger wrappers (`set_kit_number`, `set_dispatch_order_number`, `set_spare_order_number`) call these generators unqualified.

## Long-run fix — two parts

### Part 1 — Fix all three pairs now (one migration)

Recreate the six functions with fully-qualified identifiers:

```sql
-- KIT
CREATE OR REPLACE FUNCTION public.generate_kit_number() ...
  RETURN 'KIT-' || LPAD(nextval('public.kit_number_seq')::text, 6, '0');

CREATE OR REPLACE FUNCTION public.set_kit_number() ...
  NEW.kit_number := public.generate_kit_number();

-- DISPATCH ORDER
CREATE OR REPLACE FUNCTION public.generate_dispatch_order_number() ...
  RETURN 'DO-' || LPAD(nextval('public.dispatch_order_seq')::text, 6, '0');

CREATE OR REPLACE FUNCTION public.set_dispatch_order_number() ...
  NEW.dispatch_order_number := public.generate_dispatch_order_number();

-- SPARE ORDER
CREATE OR REPLACE FUNCTION public.generate_spare_order_number() ...
  RETURN 'SO-' || LPAD(nextval('public.spare_order_seq')::text, 6, '0');

CREATE OR REPLACE FUNCTION public.set_spare_order_number() ...
  NEW.spare_order_number := public.generate_spare_order_number();
```

All other `search_path=''` functions in the codebase were checked — they already qualify `public.` correctly. This migration closes every currently known gap.

### Part 2 — Prevent recurrence

1. **Guardrail migration**: add a one-time DO block that scans `pg_proc` for any `public` function with empty `search_path` whose body contains an unqualified `nextval(...)` call or unqualified call to another `public` function, and `RAISE EXCEPTION` if found. Run it at the end of every new migration we ship from now on (or as a CI check) so a regression fails loud at migration time, not at runtime.
2. **Promote the rule to a Core memory entry** that is more explicit than today's one-liner:
   > Any function with `SET search_path TO ''` must schema-qualify *every* table, sequence, type, and function call (`public.foo`, `nextval('public.foo_seq')`). Trigger wrappers calling generators must also use `public.<fn>()`.
3. **Standard template** for sequence-backed number generators (kit/PO/GRN/DO/SO/etc.) stored in `mem://database/secure-functions` so future generators are copied from a known-good shape.

## Scope of changes

- 1 migration file (six `CREATE OR REPLACE FUNCTION` statements + optional guardrail DO block).
- 1 memory update (`mem://database/secure-functions`) — text only, no code.
- **No frontend changes**, no schema changes, no RLS changes, no GRANT changes.

## Verification

1. `/store` → Production Voucher → View Details → Dispatch Material → succeeds, `kit_preparation` row gets `KIT-000001`.
2. Create a dispatch order from Sales → succeeds with `DO-000001`.
3. Create a spare order → succeeds with `SO-000001`.
4. Re-run the guardrail scan query → returns zero rows.
