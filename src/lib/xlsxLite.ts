import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * A small Excel reader/writer for plain lists (header in row 1, one record a row).
 * Used by Import / Export. The formatted masters (Part Code Master, CRS) are filled
 * into their own templates instead, so they keep every style of the offline files.
 */

export type Cell = string | number | null | undefined;
export interface SheetSpec {
  name: string;
  header: string[];
  rows: Cell[][];
  /** Column widths in characters; defaults from the header. */
  widths?: number[];
  /** Column indexes whose header is shown as required (dark fill). */
  required?: number[];
}

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="@"/></numFmts>
<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(s: SheetSpec) {
  const ncol = s.header.length;
  const widths = s.widths ?? s.header.map((h) => Math.min(Math.max(h.length + 4, 12), 40));
  const req = new Set(s.required ?? []);
  const cell = (r: number, c: number, v: Cell, style: number) => {
    const ref = `${colName(c)}${r}`;
    if (v === null || v === undefined || v === "") return `<c r="${ref}" s="${style}"/>`;
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
  };
  const head = `<row r="1" ht="30" customHeight="1">${s.header.map((h, c) => cell(1, c, h, req.has(c) ? 2 : 1)).join("")}</row>`;
  const body = s.rows.map((row, i) =>
    `<row r="${i + 2}">${Array.from({ length: ncol }, (_, c) => cell(i + 2, c, row[c], 3)).join("")}</row>`).join("");
  const last = `${colName(ncol - 1)}${Math.max(s.rows.length + 1, 1)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${last}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${head}${body}</sheetData>
${s.rows.length ? `<autoFilter ref="A1:${last}"/>` : ""}
</worksheet>`;
}

/** A workbook of plain lists; the first sheet opens first. */
export function writeWorkbook(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const w = (p: string, s: string) => { files[p] = strToU8(s); };
  w("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  w("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  w("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${
    sheets.some((s) => s.rows.length) ? `<definedNames>${sheets.map((s, i) => s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name.slice(0, 31)).replace(/'/g, "''")}'!$A$1:$${colName(s.header.length - 1)}$${s.rows.length + 1}</definedName>` : "").join("")}</definedNames>` : ""}</workbook>`);
  w("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  w("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => w(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zipSync(files, { level: 6 });
}

/* ------------------------------------------------------------------ reading */

const unesc = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
/** Text of an <si> or <is>: all <t> runs, without phonetic hints. */
const runText = (xml: string) =>
  [...xml.replace(/<rPh\b.*?<\/rPh>/gs, "").matchAll(/<t\b[^>]*>(.*?)<\/t>|<t\b[^>]*\/>/gs)].map((m) => unesc(m[1] ?? "")).join("");

/** Built-in and custom number formats that are dates. */
function dateStyles(styles: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom.set(Number(m[1]), unesc(m[2]));
  const isDate = (id: number) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) ||
    (custom.has(id) && /[dmy]/i.test(custom.get(id)!.replace(/"[^"]*"|\[[^\]]*\]/g, "")));
  const xfs = styles.match(/<cellXfs\b[^>]*>(.*?)<\/cellXfs>/s)?.[1] ?? "";
  const out = new Set<number>();
  [...xfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].forEach((m, i) => {
    const id = Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    if (isDate(id)) out.add(i);
  });
  return out;
}

const serialToIso = (n: number) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
  return d.toISOString().slice(0, 10);
};

/** The first sheet (or the one named) as rows of text; dates come back as YYYY-MM-DD. */
export function readWorkbook(bytes: Uint8Array, sheetName?: string): string[][] {
  const files = unzipSync(bytes);
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const wb = read("xl/workbook.xml");
  if (!wb) throw new Error("This is not an Excel (.xlsx) file.");
  const sheets = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({
    name: unesc(m[1].match(/name="([^"]*)"/)?.[1] ?? ""),
    rid: m[1].match(/r:id="([^"]*)"/)?.[1] ?? "",
    hidden: /state="(hidden|veryHidden)"/.test(m[1]),
  }));
  const pick = (sheetName && sheets.find((s) => s.name.toLowerCase() === sheetName.toLowerCase())) || sheets.find((s) => !s.hidden) || sheets[0];
  if (!pick) throw new Error("The workbook has no sheets.");
  const rels = read("xl/_rels/workbook.xml.rels");
  const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${pick.rid}"[^>]*Target="([^"]+)"`))?.[1]
    ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${pick.rid}"`))?.[1];
  if (!target) throw new Error("Could not find the sheet in the workbook.");
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)].map((m) => runText(m[1]));
  const dates = dateStyles(read("xl/styles.xml"));
  const xml = read(path);
  const out: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>(.*?)<\/row>/gs)) {
    const rowNum = Number(rm[1].match(/\br="(\d+)"/)?.[1] ?? out.length + 1);
    const row: string[] = [];
    let next = 0;
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const ci = ref ? colIndex(ref) : next;
      next = ci + 1;
      const inner = cm[2] ?? "";
      const t = attrs.match(/\bt="(\w+)"/)?.[1];
      const s = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0);
      const v = inner.match(/<v>(.*?)<\/v>/s)?.[1];
      let text = "";
      if (t === "s") text = shared[Number(v)] ?? "";
      else if (t === "inlineStr") text = runText(inner.match(/<is>(.*?)<\/is>/s)?.[1] ?? "");
      else if (t === "b") text = v === "1" ? "TRUE" : "FALSE";
      else if (t === "str" || t === "e") text = unesc(v ?? "");
      else if (v !== undefined) {
        const n = Number(v);
        text = dates.has(s) && Number.isFinite(n) ? serialToIso(n) : String(Number.isFinite(n) ? +n.toPrecision(15) : v);
      }
      row[ci] = text.trim();
    }
    out[rowNum - 1] = Array.from(row, (x) => x ?? "");
  }
  return Array.from(out, (r) => r ?? []);
}

/** Comma / semicolon / tab separated text, quotes allowed. */
export function readCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur.trim()); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur.trim()); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows;
}

/** .xlsx or .csv from a file the user picked. */
export async function readSpreadsheetFile(file: File, sheetName?: string): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name) || /^text\//.test(file.type)) return readCsv(new TextDecoder().decode(buf).replace(/^﻿/, ""));
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files cannot be read. Open it in Excel and Save As .xlsx.");
  return readWorkbook(buf, sheetName);
}

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const ddmmyyyy = (d: Date = new Date()) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
