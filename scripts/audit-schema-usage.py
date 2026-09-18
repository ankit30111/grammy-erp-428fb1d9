#!/usr/bin/env python3
"""
Static audit of every Supabase call in the app against the live schema.

Finds, without anyone clicking anything:
  1. .from('table') where the table does not exist
  2. .insert({...}) / .update({...}) keys that are not columns of that table
  3. .select('a, b, c') fields that are not columns
  4. .eq('col', ...) / .in('col', [...]) on columns that do not exist
  5. enum-valued columns compared or written with a value outside the enum
  6. .rpc('fn') where the function does not exist or the app cannot execute it
  7. tables the app READS but nothing ever writes - a feature with a reader and
     no writer, which looks like "no data yet" forever
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

# supabase.rpc('name') where the function is not callable by the app role.
#
# Four of these were live: generate_temp_part_code, get_customer_finance,
# get_vendor_finance and log_material_movement. Each throws the moment the screen
# that calls it is opened, and three of the four had their error swallowed. A
# missing function is as fatal as a missing table, so it is checked the same way.
RPC = re.compile(r"\.rpc\(\s*['\"]([a-z_0-9]+)['\"]")
FUNCS = set(SCHEMA.get('functions', []))

for path in walk():
    src = open(path, errors='ignore').read()
    for m in RPC.finditer(src):
        if FUNCS and m.group(1) not in FUNCS:
            line = src[:m.start()].count('\n') + 1
            findings['dead_rpc'].append(
                f"{rel(path)}:{line}  .rpc('{m.group(1)}') — function does not exist, or the app cannot execute it")

# Tables the app reads but never writes.
#
# This is the class of bug the audit kept missing, and it is the expensive one:
# every table, column, enum and function referenced can exist and be spelled
# correctly, and the feature can still be dead because nothing ever puts a row in.
#
# stock_holds was exactly this. VoucherMaterials read it, materialShortageCalculator
# read it, the netting maths depended on it - and the one insert that fed it was
# refused by a check constraint on every attempt, silently, into a toast. Three
# vouchers each believed they had the whole warehouse. Nothing in checks 1-6 could
# see it: the table existed, the columns existed, the query was valid.
#
# A table read-but-never-written is not always wrong - some are filled by triggers,
# by a migration backfill, or by another system. So this is a question, not a
# verdict: DB_WRITERS lists the tables known to be written from SQL rather than
# from the app, and anything else that only ever appears after .select() gets
# named here to be checked by a human.
# Each entry says WHY it is written outside the app, so the list cannot quietly
# become a place to hide real findings.
DB_WRITERS = {
    'stock_ledger':             'post_stock_movement() is the only entry point',
    'stock_balance':            'derived from stock_ledger by trigger',
    'stock_holds':              'maintained by sync_voucher_holds() from the voucher',
    'audit_log':                'audit triggers',
    'projections':              'scheduled/vouchered totals recomputed by trigger',
    'purchase_order_items':     'received_quantity maintained by the GRN trigger',
    'finished_goods_inventory': 'receive_finished_goods() / allocate_finished_goods()',
    'dispatch_order_items':     'written by allocate_finished_goods()',
    'kit_feedback':             'raised by record_kit_receipt()',
    'production_order_lines':   'written with the schedule',
    'department_permissions':   'written by the set_department_modules() RPC',
    'stock_locations':          'reference data, seeded by migration',
}

READ = re.compile(r"\.select\(")
WRITE = re.compile(r"\.(insert|update|upsert|delete)\(")

read_tables, written_tables = set(), set()
for path in walk():
    src = open(path, errors='ignore').read()
    for table, chain, _ in chains(src):
        if table not in TABLES:
            continue
        if READ.search(chain):
            read_tables.add(table)
        if WRITE.search(chain):
            written_tables.add(table)

for t in sorted(read_tables - written_tables - set(DB_WRITERS)):
    findings['read_never_written'].append(
        f"{t} — the app reads this table and never writes to it. Filled by a trigger, "
        f"or is the writing half missing?")

ORDER = [
    ('dead_table',     'QUERIES A TABLE THAT NO LONGER EXISTS'),
    ('dead_rpc',       'CALLS A FUNCTION THAT DOES NOT EXIST'),
    ('read_never_written', 'READ BY THE APP, NEVER WRITTEN BY IT  (check each: trigger-fed, or half-built?)'),
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
