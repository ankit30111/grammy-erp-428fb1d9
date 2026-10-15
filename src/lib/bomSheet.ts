import { strToU8, zipSync } from "fflate";

/**
 * One product's BOM as one Excel sheet, in Grammy's offline BOM layout:
 *
 *   BOM <code>                                           | VER x.y
 *   S.NO. | PART CODE | ITEM NAME | QPS | LEAD TIME | VENDOR | CONTACT PERSON | CONTACT NO.
 *   1     | B-068     | ...        | 1   |           | ...    | ...            | ...
 *   5     | SA-003    | AMP BOARD  | 1   |   (sub-assembly, opened underneath)
 *   5.1   | E-021     |   └ PCB …  | 2   |   (quantity per product)
 *   ...
 *   DATE : dd-mm-yyyy | PREPARED BY: | CHECKED BY: | APPROVED BY:
 *   DOC:
 *
 * Rows next to each other with the same vendor share one vendor / contact cell,
 * as in the offline sheets.
 */

export interface BomSheetLine {
  sno: string;
  level: number;
  part_code: string;
  name: string;
  qps: number | null;          // per product; null = issued in bulk
  subassembly: boolean;
  vendor?: string | null;
  contact_person?: string | null;
  contact_number?: string | null;
}

export interface BomSheetInput {
  title: string;               // "BOM JA-006-PH"
  version: string;             // "VER1.0"
  sheetName: string;
  date: string;                // dd-mm-yyyy
  lines: BomSheetLine[];
}

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const COLS = "ABCDEFGH";

type Edge = "thin" | "medium" | null;
interface Style { font: number; border: [Edge, Edge, Edge, Edge]; h: "left" | "center"; v?: "center" | "top"; wrap?: boolean }

const FONTS = [
  `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>`,           // 0
  `<font><b/><sz val="28"/><name val="Calibri"/><family val="2"/></font>`,       // 1 title
  `<font><b/><sz val="16"/><name val="Calibri"/><family val="2"/></font>`,       // 2 version
  `<font><b/><sz val="13"/><name val="Calibri"/><family val="2"/></font>`,       // 3 header
  `<font><sz val="10"/><name val="Calibri"/><family val="2"/></font>`,           // 4 data
  `<font><b/><sz val="10"/><name val="Calibri"/><family val="2"/></font>`,       // 5 sub-assembly
  `<font><b/><sz val="12"/><name val="Calibri"/><family val="2"/></font>`,       // 6 footer
];

export function buildBomSheet(input: BomSheetInput): Uint8Array {
  // ---- styles, made as they are needed ---------------------------------------
  const borders: string[] = [`<border><left/><right/><top/><bottom/><diagonal/></border>`];
  const borderIdx = new Map<string, number>();
  const xfs: string[] = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`];
  const xfIdx = new Map<string, number>();
  const edge = (tag: string, e: Edge) => (e ? `<${tag} style="${e}"><color auto="1"/></${tag}>` : `<${tag}/>`);
  const style = (s: Style) => {
    const bk = s.border.join(",");
    let b = borderIdx.get(bk);
    if (b === undefined) {
      b = borders.length;
      borders.push(`<border>${edge("left", s.border[0])}${edge("right", s.border[1])}${edge("top", s.border[2])}${edge("bottom", s.border[3])}<diagonal/></border>`);
      borderIdx.set(bk, b);
    }
    const key = `${s.font}|${b}|${s.h}|${s.v ?? "center"}|${s.wrap ? 1 : 0}`;
    let x = xfIdx.get(key);
    if (x === undefined) {
      x = xfs.length;
      xfs.push(`<xf numFmtId="0" fontId="${s.font}" fillId="0" borderId="${b}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${s.h}" vertical="${s.v ?? "center"}"${s.wrap ? ' wrapText="1"' : ""}/></xf>`);
      xfIdx.set(key, x);
    }
    return x;
  };

  const rows: string[] = [];
  const merges: string[] = [];
  const heights: Record<number, number> = {};
  const cell = (ref: string, s: number, v?: string | number | null) => {
    if (v === null || v === undefined || v === "") return `<c r="${ref}" s="${s}"/>`;
    if (typeof v === "number") return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const sideL = (c: number): Edge => (c === 0 ? "medium" : "thin");
  const sideR = (c: number): Edge => (c === 7 ? "medium" : "thin");

  // ---- 1: title + version ------------------------------------------------------
  {
    const t = style({ font: 1, border: ["medium", "medium", "medium", "medium"], h: "center" });
    const v = style({ font: 2, border: ["medium", "medium", "medium", "medium"], h: "center" });
    rows.push(`<row r="1" ht="40.25" customHeight="1">${[0, 1, 2, 3, 4, 5].map((c) => cell(`${COLS[c]}1`, t, c === 0 ? input.title : null)).join("")}${cell("G1", v, input.version)}${cell("H1", v)}</row>`);
    merges.push("A1:F1", "G1:H1");
  }
  // ---- 2: header ---------------------------------------------------------------
  {
    const head = ["S.NO.", "PART CODE", "ITEM NAME", "QPS", "LEAD TIME", "VENDOR", "CONTACT PERSON", "CONTACT NO."];
    rows.push(`<row r="2" ht="17.25" customHeight="1">${head.map((h, c) =>
      cell(`${COLS[c]}2`, style({ font: 3, border: [sideL(c), sideR(c), "medium", "medium"], h: "center", wrap: true }), h)).join("")}</row>`);
  }

  // ---- data --------------------------------------------------------------------
  const first = 3;
  const lines = input.lines;
  // Runs of the same vendor share the vendor and contact cells.
  const runEnd: number[] = lines.map(() => -1);
  for (let i = 0; i < lines.length; ) {
    const v = (lines[i].vendor ?? "").trim().toUpperCase();
    let j = i;
    while (v && j + 1 < lines.length && (lines[j + 1].vendor ?? "").trim().toUpperCase() === v) j++;
    runEnd[i] = j;
    if (j > i) for (const c of "EFGH") merges.push(`${c}${first + i}:${c}${first + j}`);
    i = j + 1;
  }
  let runStart = 0;
  lines.forEach((l, i) => {
    if (runEnd[i] >= 0) runStart = i;
    const r = first + i;
    const bold = l.subassembly;
    const st = (c: number, h: "left" | "center", wrap = false) =>
      style({ font: bold && (c === 1 || c === 2) ? 5 : 4, border: [sideL(c), sideR(c), "thin", "thin"], h, wrap });
    const isRunHead = runStart === i;
    const indent = l.level > 0 ? `${"   ".repeat(l.level - 1)}└ ` : "";
    rows.push(`<row r="${r}" ht="12.5" customHeight="1">${[
      cell(`A${r}`, st(0, "center"), /^\d+$/.test(l.sno) ? Number(l.sno) : l.sno),
      cell(`B${r}`, st(1, "center"), l.part_code),
      cell(`C${r}`, st(2, "left"), indent + l.name),
      cell(`D${r}`, st(3, "center"), l.qps),
      cell(`E${r}`, st(4, "center"), null),
      cell(`F${r}`, st(5, "left", true), isRunHead ? l.vendor ?? null : null),
      cell(`G${r}`, st(6, "center", true), isRunHead ? l.contact_person ?? null : null),
      cell(`H${r}`, st(7, "center"), isRunHead ? l.contact_number ?? null : null),
    ].join("")}</row>`);
  });

  // ---- footer: two blank rows, then the sign-off block ------------------------
  const f1 = first + lines.length + 2;
  const fb = (c: number, rr: number) => style({
    font: 6, h: "left", v: "top",
    border: [sideL(c), sideR(c), rr === 0 ? "medium" : "thin", rr === 2 ? "medium" : "thin"],
  });
  const footerText: Record<string, string> = {
    [`A${f1}`]: `DATE : ${input.date}`, [`C${f1}`]: "PREPARED BY:", [`D${f1}`]: "CHECKED BY:", [`G${f1}`]: "APPROVED BY:", [`A${f1 + 1}`]: "DOC:",
  };
  for (let rr = 0; rr < 3; rr++) {
    const r = f1 + rr;
    heights[r] = rr === 0 ? 19.25 : 14.25;
    rows.push(`<row r="${r}" ht="${heights[r]}" customHeight="1">${[0, 1, 2, 3, 4, 5, 6, 7].map((c) =>
      cell(`${COLS[c]}${r}`, fb(c, rr), footerText[`${COLS[c]}${r}`] ?? null)).join("")}</row>`);
  }
  merges.push(`A${f1}:B${f1}`, `C${f1}:C${f1 + 2}`, `D${f1}:F${f1 + 2}`, `G${f1}:H${f1 + 2}`, `A${f1 + 1}:B${f1 + 2}`);

  const last = f1 + 2;
  const widths = [7.5, 14.16, 40, 6.5, 12.5, 24, 19.66, 18.16];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:H${last}"/>
<sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="12.5"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData>
<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>
<printOptions horizontalCentered="1"/>
<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join("")}</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const name = esc(input.sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${name.replace(/'/g, "''")}'!$1:$2</definedName></definedNames></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(styles),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}
