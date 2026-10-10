"""Reads the CRS template (GA/QMS/RND/DOC/044) and writes src/lib/crs/crsFields.json:
the Field Dictionary, the pick-lists, and each category sheet's rows (Field ID -> row).
Run again whenever the template's revision changes:  python3 scripts/crs/build-fields.py public/templates/crs-template-rev1.0.xlsx"""
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
CATS = ['Party Speaker', 'Soundbar', 'Microphone', 'BT Speaker', 'Tower Speaker', 'Trolley Speaker']
fd = wb['Field Dictionary']
fields = {}
for r in fd.iter_rows(min_row=2, values_only=True):
    if not r[0]: continue
    fields[r[0]] = dict(section=r[1], parameter=r[2], type=r[3], unit=r[4] or '', pick=r[5] or '',
                        mandatory=r[6] == 'Y', requiredBy=r[7] or '', help=r[14] or '')
lists = {}
for col in wb['Lists'].iter_cols(values_only=True):
    v = [x for x in col if x is not None]
    if v: lists[v[0]] = [str(x) for x in v[1:]]
sheets = {}
for c in CATS:
    ws = wb[c]
    rows = []
    for i in range(2, ws.max_row + 1):
        fid = ws.cell(i, 1).value
        if fid and str(fid).startswith('CRS-'):
            rows.append([fid, i, ws.cell(i, 4).value or ''])
    sheets[c] = rows
json.dump(dict(revision='Rev 1.0', document='GA/QMS/RND/DOC/044', fields=fields, lists=lists, sheets=sheets),
          open('src/lib/crs/crsFields.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(fields), {k: len(v) for k, v in sheets.items()})
