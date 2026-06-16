## Why `/management/plants` is empty

The page issues a plain `supabase.from("plants").select("*")`. The two plants (GE, GA) exist in the DB, but the query returns nothing because **the `plants` table has no Data-API GRANTs at all** — confirmed:

```
has_table_privilege('authenticated', 'public.plants', 'SELECT') → false
information_schema.role_table_grants WHERE table_name='plants'  → 0 rows
```

The RLS policies on `plants` are correct (admin OR assigned user can SELECT), but PostgREST checks the table-level GRANT first. With no GRANT, every authenticated request is rejected before RLS is even consulted, so the page renders the "No plants yet" empty state.

The same gap exists on two sibling tables used elsewhere in the plant flow:

- `public.production_lines` — no grants
- `public.user_plants` — no grants

These weren't reported yet, but they're behind the "Lines" dialog and the plant-permissions UI and will fail the same way.

## Fix

One migration adding the standard Data-API grants. RLS is already enabled and policies already enforce per-user scoping, so this only restores reachability — it does not widen who can see what.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants          TO authenticated;
GRANT ALL                              ON public.plants          TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;
GRANT ALL                              ON public.production_lines TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plants      TO authenticated;
GRANT ALL                              ON public.user_plants      TO service_role;
```

No `anon` grants — every policy on these tables scopes to authenticated users (admin check or `auth.uid()` match).

No frontend changes needed.

## Verification

- Refresh `/management/plants` → both plants (GE, GA) render as cards.
- Header PlantSwitcher continues to list both plants.
- Open a plant's "Lines" dialog → production lines load.
