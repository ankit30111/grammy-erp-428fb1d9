# Schema usage audit

Checks every Supabase call in `src/` against the live database, without anyone
having to click through the app.

It exists because we were finding these one at a time, in production, with Ankit
as the test suite. Each fix revealed the next breakage only when he hit it. This
finds the whole set in one pass.

## What it catches

| Check | Why it matters |
|---|---|
| `.from('table')` on a dropped table | Fails at runtime, never at build |
| Enum value the column does not allow | `invalid input value for enum ...` |
| `.insert`/`.update` key that is not a column | `Could not find the 'x' column` |
| `.eq`/`.in` filter on a missing column | Silently returns nothing |
| `.select` field that is not a column | Silently returns nothing |

The first three are the ones that throw. Filters and selects on missing columns
are worse in practice: no error, just an empty screen.

## Running it

    python3 scripts/refresh-schema.py    # pull the live schema (needs SUPABASE_PAT)
    python3 scripts/audit-schema-usage.py

## Known false positives

PostgREST embed syntax (`parts!inner(...)`) parses as a column named `inner`, and
fields inside an embed are attributed to the outer table. Ignore anything named
`inner`, and sanity-check select findings against the embedded table before acting.
The dead-table, enum and write-column findings are exact.
