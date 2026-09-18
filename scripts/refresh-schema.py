#!/usr/bin/env python3
"""
Pull the live schema for audit-schema-usage.py.

    SUPABASE_PAT=sbp_... python3 scripts/refresh-schema.py

Writes scripts/.schema-cache.json and scripts/.col-enum-cache.json.
Both are caches of the live database - never edit them by hand.
"""
import json, os, sys, urllib.request

PROJECT = os.environ.get("SUPABASE_PROJECT_REF", "oacdhvmpkuadlyvvvbpq")
TOKEN = os.environ.get("SUPABASE_PAT")
if not TOKEN:
    sys.exit("Set SUPABASE_PAT (Supabase dashboard -> Account -> Access Tokens)")

HERE = os.path.dirname(os.path.abspath(__file__))


def run(sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


schema = run("""
select json_build_object(
 'columns', (select json_agg(json_build_object('t',table_name,'c',column_name))
             from information_schema.columns where table_schema='public'),
 'enums', (select json_agg(json_build_object('n',n,'v',v)) from (
             select t.typname as n, array_agg(e.enumlabel order by e.enumsortorder) as v
             from pg_type t join pg_enum e on e.enumtypid=t.oid
             join pg_namespace ns on ns.oid=t.typnamespace where ns.nspname='public'
             group by t.typname) s),
 'tables', (select json_agg(table_name) from information_schema.tables
            where table_schema='public' and table_type='BASE TABLE'),
 -- Views are legitimate .from() targets too. Collected separately because you
 -- cannot insert into one, so the read-but-never-written check must skip them
 -- rather than report every view as a half-built feature.
 'views', (select coalesce(json_agg(table_name), '[]'::json) from information_schema.tables
           where table_schema='public' and table_type='VIEW')
) as schema
""")[0]["schema"]

col_enum = {
    r["col"]: r["enum_name"]
    for r in run("""
      select c.table_name||'.'||c.column_name as col, c.udt_name as enum_name
      from information_schema.columns c
      join pg_type t on t.typname=c.udt_name
      join pg_namespace n on n.oid=t.typnamespace and n.nspname='public'
      where c.table_schema='public' and t.typtype='e'
    """)
}

# Functions the app can call through supabase.rpc(). Only those actually
# executable by the app role are listed - a function that exists but has no
# EXECUTE grant fails at runtime exactly like one that does not exist.
schema["functions"] = [
    r["proname"]
    for r in run("""
      select distinct p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      where has_function_privilege('authenticated', p.oid, 'EXECUTE')
      order by 1
    """)
]

json.dump(schema, open(os.path.join(HERE, ".schema-cache.json"), "w"))
json.dump(col_enum, open(os.path.join(HERE, ".col-enum-cache.json"), "w"))
print(
    f"tables {len(schema['tables'])}  columns {len(schema['columns'])}  "
    f"views {len(schema.get('views', []))}  "
    f"enums {len(schema['enums'])}  enum-typed columns {len(col_enum)}  "
    f"callable functions {len(schema.get('functions', []))}"
)
