#!/usr/bin/env python3
"""
Static audit of every Supabase call in the app against the live schema.

Finds, without anyone clicking anything:
  1. .from('table') where the table does not exist
  2. .insert({...}) / .update({...}) keys that are not columns of that table
  3. .select('a, b, c') fields that are not columns
  4. .eq('col', ...) / .in('col', [...]) on columns that do not exist
  5. enum-valued columns compared or written with a value outside the enum
"""
import json, re, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = json.load(open(os.path.join(HERE, '.schema-cache.json')))
TABLES = set(SCHEMA['tables'])
COLS = defaultdict(set)
for r in SCHEMA['columns']:
    COLS[r['t']].add(r['c'])
ENUMS = {e['n']: set(e['v']) for e in SCHEMA['enums']}

# Which columns are enum-typed, and which enum. Filled from a second query.
_ce = os.path.join(HERE, '.col-enum-cache.json')
COL_ENUM = json.load(open(_ce)) if os.path.exists(_ce) else {}

SRC = os.path.join(os.path.dirname(HERE), 'src')
findings = defaultdict(list)

def walk():
    for root, _, files in os.walk(SRC):
        if 'integrations/supabase/types.ts' in root:
            continue
        for f in files:
            if f.endswith(('.ts', '.tsx')):
                p = os.path.join(root, f)
                if p.endswith('types.ts'):
                    continue
                yield p

# .from('x') and the chained calls that follow, up to the next .from( or end.
#
# This was one regex with a lookahead: (.{0,2500}?)(?=\.from\(|\Z). The last chain
# in a file was silently dropped whenever it sat more than 2500 characters from the
# end - the lookahead could reach neither the next .from( nor \Z, the match failed,
# and the query was never checked at all. ProjectGanttChart's query against
# pre_existing_projects, a table that does not exist, went unreported for exactly
# this reason. An audit that quietly skips what it cannot parse is worse than no
# audit, so the chain boundaries are now found explicitly.
FROM = re.compile(r"\.from\(\s*['\"]([a-z_0-9]+)['\"]\s*\)")


def chains(src):
    """Yield (table, chain_text, start_offset) for every .from('x') in the file."""
    hits = list(FROM.finditer(src))
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(src)
        yield m.group(1), src[m.end():min(end, m.end() + 2500)], m.start()
KEYS   = re.compile(r"\.(insert|update|upsert)\(\s*\{(.*?)\}\s*\)", re.S)
KEY    = re.compile(r"^\s*([a-z_0-9]+)\s*:", re.M)
EQ     = re.compile(r"\.(?:eq|neq|gt|gte|lt|lte|is|in|like|ilike|order)\(\s*['\"]([a-z_0-9.]+)['\"]")
SELECT = re.compile(r"\.select\(\s*[`'\"](.*?)[`'\"]\s*[,)]", re.S)
ENUMCMP= re.compile(r"\.(?:eq|neq)\(\s*['\"]([a-z_0-9]+)['\"]\s*,\s*['\"]([A-Za-z_ ]+)['\"]\s*\)")
ENUMIN = re.compile(r"\.in\(\s*['\"]([a-z_0-9]+)['\"]\s*,\s*\[(.*?)\]", re.S)

def rel(p): return os.path.relpath(p, os.path.dirname(HERE))

for path in walk():
    src = open(path, errors='ignore').read()
    for table, chain, offset in chains(src):
        line = src[:offset].count('\n') + 1

        if table not in TABLES:
            findings['dead_table'].append(f"{rel(path)}:{line}  .from('{table}') — table does not exist")
            continue

        valid = COLS[table]

        # insert / update keys
        for km in KEYS.finditer(chain):
            for k in KEY.findall(km.group(2)):
                if k not in valid:
                    findings['bad_write_col'].append(f"{rel(path)}:{line}  {table}.{k} — not a column")

        # filters
        for col in EQ.findall(chain):
            base = col.split('.')[0]
            if '.' in col:
                continue  # embedded-table filter, skip
            if base not in valid:
                findings['bad_filter_col'].append(f"{rel(path)}:{line}  {table}.{base} — not a column (filter)")

        # select fields: only top-level bare identifiers, skip embeds
        sm = SELECT.search(chain)
        if sm:
            body = sm.group(1)
            # Drop embeds entirely - name, modifier, alias and body. Nested embeds
            # need a loop: one pass only removes the innermost parentheses, which
            # used to leave the outer embed's tokens behind and report them as
            # columns of the parent table.
            prev = None
            while prev != body:
                prev = body
                body = re.sub(
                    r"(?:[a-z_0-9]+\s*:\s*)?"        # optional alias:
                    r"[a-z_0-9]+"                     # embedded table (or FK hint)
                    r"(?:\s*![a-z_0-9]+)?"            # !inner / !left / !fk_name
                    r"\s*\([^()]*\)",                 # its own field list
                    "", body)
            # A bare "table!inner" with no body is still an embed hint, not a column.
            body = re.sub(r"[a-z_0-9]+\s*!\s*[a-z_0-9]+", "", body)
            for fld in re.findall(r"[a-z_0-9]+", body):
                if fld in ('count', 'sum', 'avg', 'min', 'max', 'exact', 'head', 'planned'):
                    continue
                if fld not in valid and fld not in TABLES:
                    findings['bad_select_col'].append(f"{rel(path)}:{line}  {table}.{fld} — not a column (select)")

        # enum values
        for col, val in ENUMCMP.findall(chain):
            en = COL_ENUM.get(f"{table}.{col}")
            if en and val not in ENUMS.get(en, set()):
                findings['bad_enum'].append(
                    f"{rel(path)}:{line}  {table}.{col} = '{val}' — not in {en} ({'|'.join(sorted(ENUMS[en]))})")
        for col, lst in ENUMIN.findall(chain):
            en = COL_ENUM.get(f"{table}.{col}")
            if en:
                for val in re.findall(r"['\"]([A-Za-z_ ]+)['\"]", lst):
                    if val not in ENUMS.get(en, set()):
                        findings['bad_enum'].append(
                            f"{rel(path)}:{line}  {table}.{col} in '{val}' — not in {en}")
        for km in KEYS.finditer(chain):
            for k, v in re.findall(r"([a-z_0-9]+)\s*:\s*['\"]([A-Za-z_ ]+)['\"]", km.group(2)):
                en = COL_ENUM.get(f"{table}.{k}")
                if en and v not in ENUMS.get(en, set()):
                    findings['bad_enum'].append(
                        f"{rel(path)}:{line}  {table}.{k} := '{v}' — not in {en} ({'|'.join(sorted(ENUMS[en]))})")

ORDER = [
    ('dead_table',     'QUERIES A TABLE THAT NO LONGER EXISTS'),
    ('bad_enum',       'WRITES OR COMPARES A VALUE THE ENUM DOES NOT ALLOW'),
    ('bad_write_col',  'WRITES A COLUMN THAT DOES NOT EXIST'),
    ('bad_filter_col', 'FILTERS ON A COLUMN THAT DOES NOT EXIST'),
    ('bad_select_col', 'SELECTS A COLUMN THAT DOES NOT EXIST'),
]
total = 0
for key, title in ORDER:
    items = sorted(set(findings[key]))
    total += len(items)
    print(f"\n{'='*78}\n{title}  ({len(items)})\n{'='*78}")
    for i in items[:60]:
        print("  " + i)
    if len(items) > 60:
        print(f"  ... and {len(items)-60} more")
print(f"\nTOTAL: {total}")
