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

## What it checks

1. `.from('table')` where the table does not exist
2. `.rpc('fn')` where the function does not exist, or `authenticated` cannot execute it
3. `.insert({...})` / `.update({...})` keys that are not columns
4. `.select('a, b, c')` fields that are not columns
5. `.eq('col', ...)` / `.in('col', [...])` on columns that do not exist
6. enum-valued columns compared or written with a value the enum does not allow

## Two bugs this audit had, and why they mattered

**It skipped the last query in a file.** The chain regex ended on a lookahead for
the next `.from(` or end-of-file, capped at 2500 characters. When the last chain
in a file sat more than 2500 characters from the end, neither alternative could be
reached, the match failed, and that query was never parsed — reported as nothing
rather than as a problem. Five queries against tables that no longer existed and
two illegal enum values hid there, including Completed Production filtering on
`OQC_APPROVED`. An audit that silently skips what it cannot parse is worse than no
audit, because it is trusted.

**It only stripped one level of embed.** Nested PostgREST embeds left the outer
embed's tokens behind, reported as columns of the parent table — `stock_balance.inner`
and 124 others. 162 findings were really 37, and the noise was what stopped anyone
reading the list.

Both are fixed. The lesson worth keeping: when this script's total drops sharply
after a change to the script itself, check whether it started skipping things
rather than assuming the code got better.
