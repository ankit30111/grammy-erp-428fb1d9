#!/usr/bin/env python3
"""
Turn Grammy's offline "Part Code 2025 Master.xlsx" into the export template the
ERP fills (src/lib/partCodeExport.ts).

Every sheet keeps its exact look: title band, logo, header row, column widths,
fonts, fills, borders, banding rule, table, freeze pane, page setup, footer
(DATE / PREPARED BY / CHECKED BY / APPROVED BY / DOC). Only the part rows are
taken out. Each category sheet keeps one empty "prototype" row (row 4, the
styles most rows of that sheet use) and its footer moved up to rows 5-7; the
ERP repeats the prototype once per part and moves the footer below them.

Run:  python3 -I prepare.py "Part Code 2025 Master.xlsx" out_dir
Writes out_dir/part-code-master-template.xlsx and out_dir/manifest.json.
"""
import collections, json, os, re, sys, zipfile

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
z = zipfile.ZipFile(src)
files = {n: z.read(n) for n in z.namelist()}
T = lambda n: files[n].decode("utf-8")

# ---- shared strings -------------------------------------------------------
ss_xml = T("xl/sharedStrings.xml")
SI = re.findall(r"<si>.*?</si>", ss_xml, re.S)
def si_text(i):
    return "".join(re.findall(r"<t[^>]*>(.*?)</t>", SI[i], re.S))

ROW_RE = re.compile(r'<row r="(\d+)"([^>]*?)(?:/>|>(.*?)</row>)', re.S)
CELL_RE = re.compile(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', re.S)

def cell_text(attrs, inner):
    inner = inner or ""
    v = re.search(r"<v>(.*?)</v>", inner, re.S)
    if 't="s"' in attrs and v:
        return si_text(int(v.group(1)))
    if v:
        return v.group(1)
    t = re.search(r"<t[^>]*>(.*?)</t>", inner, re.S)
    return t.group(1) if t else None

def parse_rows(xml):
    rows = []
    for m in ROW_RE.finditer(xml):
        r, attrs, body = int(m.group(1)), m.group(2), m.group(3) or ""
        cells = [(c.group(1), int(c.group(2)), c.group(3), c.group(4)) for c in CELL_RE.finditer(body)]
        rows.append((r, attrs, cells, m.group(0)))
    return rows

def col_num(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n

# ---- workbook map ---------------------------------------------------------
wb = T("xl/workbook.xml")
rels = T("xl/_rels/workbook.xml.rels")
rid_target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))
sheets = [(name, rid_target[rid]) for name, rid in re.findall(r'<sheet name="([^"]+)" sheetId="\d+" r:id="(rId\d+)"/>', wb)]

manifest = {"sheets": []}

def sheet_rels_path(path):
    d, f = path.rsplit("/", 1)
    return f"{d}/_rels/{f}.rels"

def renumber_row(row_xml, old, new):
    row_xml = re.sub(r'<row r="%d"' % old, '<row r="%d"' % new, row_xml, count=1)
    return re.sub(r'(<c r="[A-Z]+)%d"' % old, lambda m: f'{m.group(1)}{new}"', row_xml)

def title_of(rows):
    for r in rows:
        if r[0] == 1:
            for c in r[2]:
                if c[0] == "A":
                    return (cell_text(c[2], c[3]) or "").strip()
    return None

def strip_selections(xml):
    xml = re.sub(r"<selection [^>]*/>", "", xml)
    return xml

for name, target in sheets:
    path = "xl/" + target
    xml = T(path)
    rows = parse_rows(xml)
    head = xml[: xml.index("<sheetData>")]
    tail = xml[xml.index("</sheetData>") + len("</sheetData>"):]

    if name in ("Change Log", "PCB Code Map"):
        manifest["sheets"].append({"name": name, "file": path, "kind": "static"})
        continue

    # Column count from the header row.
    header = next(r for r in rows if r[0] == 3)
    last_col = max(header[2], key=lambda c: col_num(c[0]))[0]
    headers = {c[0]: (cell_text(c[2], c[3]) or "").strip() for c in header[2]}

    if name == "MASTER":
        proto = next(r for r in rows if r[0] == 5)  # a plain value row
        keep = [r[3] for r in rows if r[0] <= 3]
        # Row 2: total counted from the rows the ERP writes.
        keep[1] = re.sub(r'<c r="A2"([^>]*?)>.*?</c>',
                         lambda m: '<c r="A2"' + re.sub(r'\s*t="\w+"', "", m.group(1)) + ' t="str"><f>"Total parts: "&amp;COUNTA(C4:C{{LAST}})</f><v>{{TOTAL}}</v></c>',
                         keep[1], count=1, flags=re.S)
        proto_xml = re.sub(r"(<c r=\"[A-Z]+5\"[^>]*?)(?:/>|>.*?</c>)", lambda m: re.sub(r'\s*t="\w+"', "", m.group(1)) + "/>", proto[3], flags=re.S)
        proto_xml = renumber_row(proto_xml, 5, 4)
        sheet_data = "<sheetData>" + "".join(keep) + proto_xml + "</sheetData>"
        head = re.sub(r'<dimension ref="[^"]+"/>', '<dimension ref="A1:%s{{LAST}}"/>' % last_col, head)
        head = re.sub(r'topLeftCell="[A-Z]+\d+"', 'topLeftCell="A4"', head)
        head = strip_selections(head)
        tail = re.sub(r'<autoFilter ref="[^"]+"/>', '<autoFilter ref="A3:%s{{LAST}}"/>' % last_col, tail)
        files[path] = (head + sheet_data + tail).encode()
        manifest["sheets"].append({"name": name, "file": path, "kind": "master", "lastCol": last_col, "headers": headers})
        continue

    # ---- category sheet ----
    footer_rows = [r for r in rows if any("PREPARED BY" in (cell_text(c[2], c[3]) or "") for c in r[2])]
    footer_start = footer_rows[0][0] if footer_rows else None
    data_rows = [r for r in rows if r[0] >= 4 and (footer_start is None or r[0] < footer_start)
                 and any(c[0] == "C" and (cell_text(c[2], c[3]) or "").strip() for c in r[2])]
    pool = data_rows or [r for r in rows if r[0] == 4]
    sig = lambda r: tuple((c[0], re.search(r's="(\d+)"', c[2]).group(1) if 's="' in c[2] else None) for c in r[2])
    common = collections.Counter(sig(r) for r in pool).most_common(1)[0][0]
    proto = next(r for r in pool if sig(r) == common)
    # Most common height among the rows with that style.
    ht = collections.Counter(re.search(r'ht="([\d.]+)"', r[1]).group(1) if 'ht="' in r[1] else None
                             for r in pool if sig(r) == common).most_common(1)[0][0]
    attrs = re.sub(r'\s+customHeight="1"', "", proto[1])
    attrs = re.sub(r'\s+ht="[\d.]+"', "", attrs)
    attrs = re.sub(r'\s*thickBot="1"', "", attrs)
    if ht:
        attrs = attrs.replace(' x14ac:dyDescent', f' ht="{ht}" customHeight="1" x14ac:dyDescent', 1) if "x14ac:dyDescent" in attrs else attrs + f' ht="{ht}" customHeight="1"'
    proto_cells = "".join(f'<c r="{c}4" s="{s}"/>' if s else f'<c r="{c}4"/>' for c, s in common)
    proto_xml = f'<row r="4"{attrs}>{proto_cells}</row>'

    keep = [r[3] for r in rows if r[0] <= 3]
    foot_xml = []
    footer_n = 0
    if footer_start:
        for r in rows:
            if footer_start <= r[0] <= footer_start + 2:
                rx = renumber_row(r[3], r[0], 5 + r[0] - footer_start)
                # DATE cell: the export date.
                rx = re.sub(r'<c r="([A-Z]+\d+)"([^>]*?)t="s"([^>]*)><v>(\d+)</v></c>',
                            lambda m: (f'<c r="{m.group(1)}"{m.group(2)}t="inlineStr"{m.group(3)}><is><t xml:space="preserve">{{{{DATE}}}}</t></is></c>'
                                       if si_text(int(m.group(4))).strip().upper().startswith("DATE") else m.group(0)), rx)
                foot_xml.append(rx)
        footer_n = len(foot_xml)

    sheet_data = "<sheetData>" + "".join(keep) + proto_xml + "".join(foot_xml) + "</sheetData>"

    # Merges: title band kept; footer merges moved to rows 5-7.
    def fix_merge(m):
        a, r1, b, r2 = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        if r2 <= 3:
            return m.group(0)
        if footer_start and r1 >= footer_start:
            return f'<mergeCell ref="{a}{5 + r1 - footer_start}:{b}{5 + r2 - footer_start}"/>'
        return ""
    tail = re.sub(r'<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/>', fix_merge, tail)
    n_merge = len(re.findall(r"<mergeCell ", tail))
    tail = re.sub(r'<mergeCells count="\d+">', f'<mergeCells count="{n_merge}">', tail)
    # Banding and other rules cover the part rows.
    tail = re.sub(r'(<conditionalFormatting sqref=")([^"]+)(")',
                  lambda m: m.group(1) + re.sub(r"([A-Z]+)4:([A-Z]+)\d+", r"\g<1>4:\g<2>{{LAST}}", m.group(2)) + m.group(3), tail)
    # Comments belonged to old part rows.
    tail = re.sub(r'<legacyDrawing r:id="rId\d+"/>', "", tail)

    head = re.sub(r'<dimension ref="[^"]+"/>', '<dimension ref="A1:%s{{END}}"/>' % last_col, head)
    head = re.sub(r'topLeftCell="([A-Z]+)\d+"', lambda m: f'topLeftCell="{m.group(1)}4"', head)
    head = strip_selections(head)
    files[path] = (head + sheet_data + tail).encode()

    # Sheet relationships: table (ref follows the rows), drawing (logo) kept, comments dropped.
    rp = sheet_rels_path(path)
    table_file = None
    if rp in files:
        r = T(rp)
        for rel in re.findall(r"<Relationship [^>]*/>", r):
            tgt = re.search(r'Target="([^"]+)"', rel).group(1)
            if "comments" in tgt or "vmlDrawing" in tgt:
                r = r.replace(rel, "")
                files.pop("xl/" + tgt.replace("../", ""), None)
            if "tables/" in tgt:
                table_file = "xl/" + tgt.replace("../", "")
        files[rp] = r.encode()
    if table_file:
        t = T(table_file)
        t = re.sub(r'ref="A3:([A-Z]+)\d+"', r'ref="A3:\g<1>{{LAST}}"', t)
        files[table_file] = t.encode()

    m = re.match(r"\S+\s*([A-Z]+)\s*-", name)
    prefix = m.group(1) if m else None
    manifest["sheets"].append({
        "name": name, "file": path, "kind": "category", "prefix": prefix, "lastCol": last_col,
        "headers": headers, "footerRows": footer_n, "table": table_file,
        "rels": rp if rp in files else None,
        "title": title_of(rows),
    })

# ---- package-level clean up -------------------------------------------------
ct = T("[Content_Types].xml")
for n in list(files):
    if re.match(r"xl/comments\d+\.xml", n) or n == "xl/calcChain.xml":
        files.pop(n)
ct = re.sub(r'<Override PartName="/xl/comments\d+\.xml"[^>]*/>', "", ct)
ct = re.sub(r'<Override PartName="/xl/calcChain\.xml"[^>]*/>', "", ct)
files["[Content_Types].xml"] = ct.encode()
rels = re.sub(r'<Relationship [^>]*Target="calcChain\.xml"/>', "", rels)
files["xl/_rels/workbook.xml.rels"] = rels.encode()
wb = re.sub(r"<calcPr [^>]*/>", '<calcPr calcId="191029" fullCalcOnLoad="1"/>', wb)
wb = re.sub(r'firstSheet="\d+" activeTab="\d+"', 'firstSheet="0" activeTab="0"', wb)
wb = re.sub(r'(<definedName name="_xlnm\._FilterDatabase" localSheetId="0" hidden="1">MASTER!\$A\$3:\$H\$)\d+', r"\g<1>{{MASTER_LAST}}", wb)
files["xl/workbook.xml"] = wb.encode()
# Sheet titles are rebuilt by Excel; the list would go stale when sheets are dropped.
app = T("docProps/app.xml")
app = re.sub(r"<HeadingPairs>.*?</HeadingPairs>", "", app, flags=re.S)
app = re.sub(r"<TitlesOfParts>.*?</TitlesOfParts>", "", app, flags=re.S)
files["docProps/app.xml"] = app.encode()

# Shared strings: keep only those still used (no part data left in the template).
used = set()
for n, b in files.items():
    if n.startswith("xl/worksheets/sheet"):
        for m in re.finditer(r'<c r="[A-Z]+\d+"[^>]*t="s"[^>]*><v>(\d+)</v>', b.decode()):
            used.add(int(m.group(1)))
order = sorted(used)
remap = {old: new for new, old in enumerate(order)}
for n in list(files):
    if n.startswith("xl/worksheets/sheet"):
        s = files[n].decode()
        s = re.sub(r'(<c r="[A-Z]+\d+"[^>]*t="s"[^>]*><v>)(\d+)(</v>)', lambda m: m.group(1) + str(remap[int(m.group(2))]) + m.group(3), s)
        files[n] = s.encode()
hdr = ss_xml[: ss_xml.index("<si>")]
hdr = re.sub(r'count="\d+"', f'count="{len(order)}"', hdr)
hdr = re.sub(r'uniqueCount="\d+"', f'uniqueCount="{len(order)}"', hdr)
files["xl/sharedStrings.xml"] = (hdr + "".join(SI[i] for i in order) + "</sst>").encode()

with zipfile.ZipFile(os.path.join(out, "part-code-master-template.xlsx"), "w", zipfile.ZIP_DEFLATED) as zo:
    for n in z.namelist():
        if n in files:
            zo.writestr(n, files[n])
with open(os.path.join(out, "manifest.json"), "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print("ok", len(manifest["sheets"]), "sheets,", len(order), "strings kept")
