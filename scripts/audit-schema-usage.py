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
  8. columns read but never written, on tables the app does write - the writer
     aimed at the wrong column
  9. components that exist but nothing imports - finished work with no way in
 10. a value a screen offers that the enum column it writes will not accept
"""
import json, re, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = json.load(open(os.path.join(HERE, '.schema-cache.json')))
# A view is a valid .from() target and has columns like any relation, so it
# belongs in TABLES for checks 1-6. VIEWS is kept separately because nothing can
# insert into a view - without it, every view would be reported as a feature with
# a reader and no writer.
VIEWS = set(SCHEMA.get('views', []))
TABLES = set(SCHEMA['tables']) | VIEWS
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

for t in sorted(read_tables - written_tables - set(DB_WRITERS) - VIEWS):
    findings['read_never_written'].append(
        f"{t} — the app reads this table and never writes to it. Filled by a trigger, "
        f"or is the writing half missing?")

# Columns the app SELECTS but never writes, on tables the app DOES write.
#
# The class of bug that produced "Issued by store: 0" on a kit that had physically
# gone out. The store wrote its quantity into kit_items.received_quantity - a real
# column on a real table, correctly spelled - instead of issued_quantity. Every
# check above passed. Nothing was missing; the wrong writer had the pen.
#
# The signature is specific and worth looking for: the app inserts into the table,
# reads a column back, and never writes that column. Either something else fills it
# (a trigger) or the writing half is aimed somewhere else. issued_quantity had
# exactly this shape - selected in four screens, written nowhere.
#
# One refinement earns the check its place. A write whose argument is a variable
# rather than an object literal - .insert(insertData), .update(updateData) - tells
# the parser which TABLE is written but not which columns, so every column of that
# table would be reported. Those tables are marked opaque and left alone; reporting
# 41 findings of which 39 are vendors.name and its friends would have made the
# check worthless, which is how an audit stops being read.
COL_WRITTEN = defaultdict(set)
COL_READ = defaultdict(set)
TABLE_WRITTEN = set()
OPAQUE_WRITE = set()
# .insert(x) / .update(x) where x is not an object literal.
OPAQUE = re.compile(r"\.(insert|update|upsert)\(\s*(?!\{)[A-Za-z_$]")

for path in walk():
    src = open(path, errors='ignore').read()
    for table, chain, _ in chains(src):
        if table not in TABLES or table in VIEWS:
            continue
        if OPAQUE.search(chain):
            OPAQUE_WRITE.add(table)
        for km in KEYS.finditer(chain):
            TABLE_WRITTEN.add(table)
            for k in KEY.findall(km.group(2)):
                COL_WRITTEN[table].add(k)
        sm = SELECT.search(chain)
        if sm:
            # Columns read through an EMBED count too, and this is not a detail:
            # kit_items.issued_quantity is only ever selected inside a
            # kit_preparation embed - `kit_items ( issued_quantity, ... )`. The
            # first version of this check stripped embeds wholesale, so the one
            # column whose absent writer caused the bug was invisible to the check
            # written to find it. Verified by putting the bug back and watching it
            # go unreported.
            for em in re.finditer(r"([a-z_0-9]+)\s*(?:![a-z_0-9]+)?\s*\(([^()]*)\)", sm.group(1)):
                et = em.group(1)
                if et in COLS:
                    for fld in re.findall(r"[a-z_0-9]+", em.group(2)):
                        if fld in COLS[et]:
                            COL_READ[et].add(fld)
            body = sm.group(1)
            prev = None
            while prev != body:
                prev = body
                body = re.sub(r"(?:[a-z_0-9]+\s*:\s*)?[a-z_0-9]+(?:\s*![a-z_0-9]+)?\s*\([^()]*\)", "", body)
            body = re.sub(r"[a-z_0-9]+\s*!\s*[a-z_0-9]+", "", body)
            for fld in re.findall(r"[a-z_0-9]+", body):
                if fld in COLS[table]:
                    COL_READ[table].add(fld)

# Columns something other than the app is expected to fill.
TRIGGER_FILLED = {
    'id', 'created_at', 'updated_at', 'created_by',
}

# Columns filled by the database rather than the app, each with the reason, so
# this cannot quietly become a place to hide real findings. Same rule as
# DB_WRITERS above: if you cannot say why, it is a finding.
DB_FILLED_COLS = {
    'part_categories.kind':          'generated column, derived from tier',
    'part_categories.next_sequence': 'advanced by next_part_code()',
    'part_categories.is_active':     'defaults true; deactivating a letter is a SQL decision',
    'parts.source_type':             'set from the category by parts_enforce_category()',
}

for table in sorted(TABLE_WRITTEN - OPAQUE_WRITE):
    for col in sorted(
        COL_READ[table] - COL_WRITTEN[table] - TRIGGER_FILLED
        - {c.split('.', 1)[1] for c in DB_FILLED_COLS if c.startswith(f'{table}.')}
    ):
        findings['col_read_never_written'].append(
            f"{table}.{col} — read by the app, never written by it")

# ---------------------------------------------------------------------------
# 9. Screens that exist but nothing links to.
# ---------------------------------------------------------------------------
# BOMManager.tsx was written, finished and committed, and no route or tab ever
# imported it. From the inside it looked done; from the app there was no way to
# reach it, and the report was "I can't see a place where I can create a BOM".
#
# This is the same failure the earlier checks catch in the database - one half of
# a job shipped without the other - only here the missing half is a link rather
# than a writer. So it is checked the same way: resolve every import in the tree
# to a real path, and name the component files nothing resolves to. Resolution is
# by path, not by basename, because two files may share a name and a check that
# guesses is a check nobody believes.
ENTRY = {'src/App.tsx', 'src/main.tsx', 'src/vite-env.d.ts'}
IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]""")
EXTS = ('', '.tsx', '.ts', '/index.tsx', '/index.ts')
ROOT = os.path.dirname(SRC)

def resolve(spec, frm):
    if spec.startswith('@/'):
        base = os.path.join(SRC, spec[2:])
    elif spec.startswith('.'):
        base = os.path.normpath(os.path.join(os.path.dirname(frm), spec))
    else:
        return None
    for e in EXTS:
        if os.path.isfile(base + e):
            return os.path.relpath(base + e, ROOT)
    return None

imported = set()
for path in walk():
    src = open(path, errors='ignore').read()
    for m in IMPORT.finditer(src):
        r = resolve(m.group(1), path)
        if r:
            imported.add(r)

for path in walk():
    # Not named `rel`: that is the helper the other checks use to print a path,
    # and shadowing it made check 10 die with "'str' object is not callable".
    rel_path = os.path.relpath(path, ROOT)
    if rel_path in ENTRY or not rel_path.endswith('.tsx'):
        continue
    if rel_path.startswith('src/components/ui/'):
        continue
    if rel_path in imported:
        continue
    findings['unreachable_screen'].append(
        f"{rel_path} — built, but nothing imports it, so there is no way to open it")

# ---------------------------------------------------------------------------
# 10. A choice on screen that the enum behind it does not accept.
# ---------------------------------------------------------------------------
# The Pass radio in IQCInspectionDialog carried value="APPROVED"; iqc_outcome
# accepts PENDING | ACCEPTED | REJECTED | PARTIAL. The handler cast the radio's
# string to the union it wanted - `value as 'ACCEPTED' | ...` - and `as` is an
# instruction to stop checking, so nothing between the click and Postgres ever
# compared the two. Clicking Pass wrote APPROVED and the row was refused.
#
# Check 5 could not see it: it only reads literals sitting inside .update({...}).
# This one works from the other end - the values a screen offers - and asks
# whether the enum that screen writes would accept them.
UI_VALUE = re.compile(r"""value=\{?['"]([A-Z][A-Z_0-9]{2,})['"]\}?""")

# Words that are choices on a screen without ever being a stored value.
UI_ONLY = {
    'ALL', 'NONE', 'ANY', 'ASC', 'DESC', 'YES', 'NO', 'TRUE', 'FALSE',
    'LOCAL', 'IMPORTED', 'PCS', 'KG', 'SET', 'BOX', 'PACK', 'ROLL', 'SHEET',
}

# A screen and the hook that does its writing are one unit: the radio lives in
# IQCInspectionDialog and the .update() lives in useIQCInspection, so a check
# that reads one file at a time sees a screen with no enum and an enum with no
# screen, and finds nothing. The writes are therefore followed through the
# component's own imports, two hops, which is how far a screen sits from its
# hook in this codebase.
writes_enum = {}
imports_of = {}
for path in walk():
    src = open(path, errors='ignore').read()
    rel_p = os.path.relpath(path, ROOT)
    here = {}
    for table, chain, _ in chains(src):
        if table not in TABLES or table in VIEWS:
            continue
        if not re.search(r"\.(insert|update|upsert)\(", chain):
            continue
        # Every enum column of a table this file writes, not only the ones named
        # in an object literal. useIQCInspection builds its row in a variable and
        # calls .update(updateData), so keying off the literal found nothing -
        # and the enum this whole check exists to police was the one it missed.
        for col in COLS[table]:
            en = COL_ENUM.get(f"{table}.{col}")
            if en:
                here[en] = f"{table}.{col}"
    writes_enum[rel_p] = here
    imports_of[rel_p] = {
        r for r in (resolve(m.group(1), path) for m in IMPORT.finditer(src)) if r
    }

def reachable(start, hops=2):
    seen, frontier = {start}, {start}
    for _ in range(hops):
        frontier = {n for f in frontier for n in imports_of.get(f, ())} - seen
        seen |= frontier
    return seen

for path in walk():
    src = open(path, errors='ignore').read()
    rel_p = os.path.relpath(path, ROOT)

    enums_here = {}
    for f in reachable(rel_p):
        enums_here.update(writes_enum.get(f, {}))
    if not enums_here:
        continue

    allowed = set()
    for en in enums_here:
        allowed |= ENUMS.get(en, set())

    # The choices are read as groups - the run of value="..." literals that make
    # up one radio group or one dropdown - and a group is only judged against an
    # enum that it is plainly already made of. If some of a group's values are
    # members of iqc_outcome and one is not, that one is the bug. If none of them
    # are members, the group is about something else entirely (currency, a
    # priority) and the check says nothing.
    #
    # Without that rule the check reports USD / RMB / INR on any screen that also
    # writes an enum, which is how a check stops being read.
    hits = list(UI_VALUE.finditer(src))
    groups, current = [], []
    for m in hits:
        if current and m.start() - current[-1].end() > 600:
            groups.append(current)
            current = []
        current.append(m)
    if current:
        groups.append(current)

    for group in groups:
        vals = [m.group(1) for m in group]
        for en, col in sorted(enums_here.items()):
            members = ENUMS.get(en, set())
            inside = [v for v in vals if v in members]
            outside = [v for v in vals if v not in members and v not in UI_ONLY]
            if not inside or not outside:
                continue
            for m in group:
                if m.group(1) in outside:
                    line = src[:m.start()].count('\n') + 1
                    findings['ui_value_not_in_enum'].append(
                        f"{rel(path)}:{line}  offers '{m.group(1)}' beside "
                        f"{'/'.join(inside)} — {col} accepts {'|'.join(sorted(members))}")

ORDER = [
    ('dead_table',     'QUERIES A TABLE THAT NO LONGER EXISTS'),
    ('dead_rpc',       'CALLS A FUNCTION THAT DOES NOT EXIST'),
    ('read_never_written', 'READ BY THE APP, NEVER WRITTEN BY IT  (check each: trigger-fed, or half-built?)'),
    ('bad_enum',       'WRITES OR COMPARES A VALUE THE ENUM DOES NOT ALLOW'),
    ('bad_write_col',  'WRITES A COLUMN THAT DOES NOT EXIST'),
    ('bad_filter_col', 'FILTERS ON A COLUMN THAT DOES NOT EXIST'),
    ('bad_select_col', 'SELECTS A COLUMN THAT DOES NOT EXIST'),
    ('col_read_never_written', 'COLUMN READ BUT NEVER WRITTEN  (trigger-filled, or is the writer aimed elsewhere?)'),
    ('unreachable_screen', 'BUILT BUT UNREACHABLE  (no route, tab or parent imports it)'),
    ('ui_value_not_in_enum', 'A CHOICE ON SCREEN THE ENUM BEHIND IT WILL REFUSE'),
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
