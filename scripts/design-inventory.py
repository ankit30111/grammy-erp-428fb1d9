#!/usr/bin/env python3
"""
What every screen is built out of.

The complaint is that the app does not read as one product, and the cause is
mechanical rather than aesthetic: pages were written at different times and only
some of them use the shared pieces. This walks the routed screens and records,
per screen, which shell it sits in, how it titles itself, how it draws a table,
how it filters, and whether it invents its own colours.

It reports patterns, not opinions. The point is to put the variants side by side
so there is something concrete to choose between.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src')

APP = open(os.path.join(SRC, 'App.tsx'), errors='ignore').read()

# import X from "./pages/Y"  ->  component -> file
IMPORTS = dict(re.findall(r'import\s+(\w+)\s+from\s+["\'](?:@/|\./)([^"\']+)["\']', APP))

# <Route path="/x" element={ ... <Component /> ... } />
ROUTES = []
for m in re.finditer(r'<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*/>', APP, re.S):
    path, el = m.group(1), m.group(2)
    comp = None
    for c in re.findall(r'<(\w+)\s*/>', el):
        if c in IMPORTS:
            comp = c
            break
    if comp:
        ROUTES.append((path, comp, IMPORTS[comp]))

NAV = ''
nav_path = os.path.join(SRC, 'components/Navigation/navigationConfig.tsx')
if os.path.exists(nav_path):
    NAV = open(nav_path, errors='ignore').read()
NAV_LABELS = dict(
    (to, label)
    for to, label in re.findall(r'to:\s*"([^"]+)".*?label:\s*"([^"]+)"', NAV, re.S | re.M)
)

def resolve(rel):
    for ext in ('.tsx', '.ts', '/index.tsx'):
        p = os.path.join(SRC, rel + ext)
        if os.path.isfile(p):
            return p
    p = os.path.join(SRC, rel)
    return p if os.path.isfile(p) else None

# Which shared piece, if any, a screen reaches for. Absence is the finding.
PATTERNS = {
    'shell:DashboardLayout':  r'<DashboardLayout',
    'shell:none':             None,                       # computed
    'title:PageHeader':       r'<PageHeader\b',
    'title:CardTitle':        r'<CardTitle\b',
    'title:raw-h1':           r'<h1\b',
    'title:raw-h2':           r'<h2\b',
    'table:shadcn':           r'<Table\b',
    'table:raw':              r'<table\b',
    'list:cards':             r'<Card\b',
    'tabs':                   r'<Tabs\b',
    'filter:Select':          r'<Select\b',
    'filter:Input-search':    r'placeholder="Search',
    'dialog:Dialog':          r'<Dialog\b',
    'dialog:Sheet':           r'<Sheet\b',
    'dialog:Drawer':          r'<Drawer\b',
    'badge':                  r'<Badge\b',
    'toast:sonner':           r'from "sonner"',
    'toast:use-toast':        r'use-toast',
    'loading:skeleton':       r'<Skeleton\b',
    'loading:spinner':        r'animate-spin',
    'loading:text':           r'Loading\.\.\.',
}

# Colours written by hand instead of taken from the theme. Each one is a place
# the app can drift out of step with itself, and the count is the honest measure
# of how far it already has.
HARDCODED = re.compile(
    r'(?:bg|text|border)-(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|amber|emerald|teal|orange|purple|pink|indigo)-\d{2,3}'
    r'|(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]'
)

pages = []
for path, comp, rel in ROUTES:
    f = resolve(rel)
    if not f:
        continue
    src = open(f, errors='ignore').read()
    used = []
    for name, pat in PATTERNS.items():
        if pat and re.search(pat, src):
            used.append(name)
    if 'shell:DashboardLayout' not in used:
        used.append('shell:none')

    hard = HARDCODED.findall(src)
    pages.append({
        'route': path,
        'component': comp,
        'file': os.path.relpath(f, ROOT),
        'nav': NAV_LABELS.get(path),
        'lines': src.count('\n') + 1,
        'patterns': sorted(used),
        'hardcoded_colours': len(hard),
        'distinct_hardcoded': len(set(hard)),
    })

pages.sort(key=lambda p: p['route'])

# Group screens by the shape they share, so the variants are countable.
def family(p):
    pat = set(p['patterns'])
    return ' + '.join([
        'shell' if 'shell:DashboardLayout' in pat else 'NO SHELL',
        'PageHeader' if 'title:PageHeader' in pat else
        ('CardTitle' if 'title:CardTitle' in pat else
         ('raw heading' if {'title:raw-h1', 'title:raw-h2'} & pat else 'no title')),
        'table' if 'table:shadcn' in pat else ('raw <table>' if 'table:raw' in pat else 'cards'),
    ])

families = {}
for p in pages:
    families.setdefault(family(p), []).append(p['route'])

out = {
    'pages': pages,
    'families': [{'shape': k, 'count': len(v), 'routes': sorted(v)}
                 for k, v in sorted(families.items(), key=lambda kv: -len(kv[1]))],
    'totals': {
        'routed_pages': len(pages),
        'no_shell': sum(1 for p in pages if 'shell:none' in p['patterns']),
        'no_page_header': sum(1 for p in pages if 'title:PageHeader' not in p['patterns']),
        'raw_tables': sum(1 for p in pages if 'table:raw' in p['patterns']),
        'hardcoded_colour_uses': sum(p['hardcoded_colours'] for p in pages),
        'both_toasts': sum(1 for p in pages
                           if {'toast:sonner', 'toast:use-toast'} <= set(p['patterns'])),
    },
}

json.dump(out, open(os.path.join(HERE, '.design-inventory.json'), 'w'), indent=1)

t = out['totals']
print(f"routed pages            {t['routed_pages']}")
print(f"  without the shell     {t['no_shell']}")
print(f"  without PageHeader    {t['no_page_header']}")
print(f"  hand-written <table>  {t['raw_tables']}")
print(f"  hard-coded colours    {t['hardcoded_colour_uses']} uses")
print(f"  two toast systems     {t['both_toasts']} pages use both")
print()
for fam in out['families']:
    print(f"{fam['count']:3}  {fam['shape']}")
