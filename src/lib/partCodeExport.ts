import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import manifest from "./partCodeExport.manifest.json";

/**
 * Grammy's offline part-code workbook ("Part Code 2025 Master.xlsx"), filled
 * from the ERP.
 *
 * The template is that workbook with the part rows taken out (see
 * scripts/part-code-template/prepare.py). Every sheet keeps its own look - title
 * band, logo, header, widths, fonts, borders, banding, table, freeze pane, page
 * setup and the DATE / PREPARED BY / CHECKED BY / APPROVED BY footer. Each
 * category sheet has one empty prototype row (row 4) in the styles that sheet
 * uses; it is repeated once per part and the footer moves below the last part.
 * Nothing else in the file is touched.
 */

export interface PartCodeRow {
  code: string;
  name: string;
  specification?: string | null;
  usedIn?: string | null;
  vendor?: string | null;
  status?: string | null;
}

export interface PartCodeSheet {
  /** Category letter(s): B, P, SA, JA ... */
  prefix: string;
  /** As written in MASTER's CATEGORY column, e.g. "B - PACKAGING". */
  categoryLabel: string;
  rows: PartCodeRow[];
  /** For a category the offline file has no sheet for (SA, JA ...). */
  sheetName?: string;
  title?: string;
}

export interface BuildOptions {
  sheets: PartCodeSheet[];
  /** Keep the reference sheets of the offline file (Change Log, PCB Code Map). */
  keepReferenceSheets?: boolean;
  date?: Date;
}

type ManifestSheet = {
  name: string; file: string; kind: "master" | "category" | "static";
  prefix?: string | null; lastCol?: string; headers?: Record<string, string>;
  footerRows?: number; table?: string | null; rels?: string | null; title?: string | null;
};
const SHEETS = (manifest as { sheets: ManifestSheet[] }).sheets;

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inlineStr = (ref: string, style: string | undefined, text: string) =>
  `<c r="${ref}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

/** What a header means, whatever the sheet calls it (S-STICKER says PART NO. / ITEM / DESCRIPTION). */
const FIELD: Record<string, keyof PartCodeRow | "sno" | "category"> = {
  "S NO.": "sno", "CATEGORY": "category",
  "PART CODE": "code", "PART NO.": "code",
  "PART NAME": "name", "ITEM": "name",
  "SPECIFICATION": "specification", "DESCRIPTION": "specification",
  "USED IN": "usedIn", "VENDOR": "vendor", "STATUS": "status",
};

/** One row of a sheet from its prototype row 4. */
function fillRow(proto: string, rowNum: number, headers: Record<string, string>, values: Record<string, string | number | null | undefined>) {
  let xml = proto.replace(/<row r="4"/, `<row r="${rowNum}"`);
  xml = xml.replace(/<c r="([A-Z]+)4"((?:\s+s="\d+")?)\/>/g, (_m, col: string, sAttr: string) => {
    const ref = `${col}${rowNum}`;
    const style = sAttr ? sAttr.match(/\d+/)![0] : undefined;
    const field = FIELD[(headers[col] ?? "").trim().toUpperCase()];
    if (field === "sno") {
      // Same formula the offline sheets use, with its value filled in.
      return `<c r="${ref}"${style ? ` s="${style}"` : ""}><f>IF($C${rowNum}="","",ROW()-3)</f><v>${rowNum - 3}</v></c>`;
    }
    const v = field ? values[field] : undefined;
    if (v === undefined || v === null || v === "") return `<c r="${ref}"${style ? ` s="${style}"` : ""}/>`;
    if (typeof v === "number") return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>`;
    return inlineStr(ref, style, String(v));
  });
  return xml;
}

const shiftRow = (rowXml: string, from: number, to: number) =>
  rowXml.replace(new RegExp(`<row r="${from}"`), `<row r="${to}"`)
    .replace(new RegExp(`(<c r="[A-Z]+)${from}"`, "g"), `$1${to}"`);

export function buildPartCodeWorkbook(template: Uint8Array, opts: BuildOptions): Uint8Array {
  const files = unzipSync(template);
  const read = (p: string) => strFromU8(files[p]);
  const write = (p: string, s: string) => { files[p] = strToU8(s); };
  const date = opts.date ?? new Date();

  let wb = read("xl/workbook.xml");
  let wbRels = read("xl/_rels/workbook.xml.rels");
  let ct = read("[Content_Types].xml");

  const byPrefix = new Map(SHEETS.filter((s) => s.kind === "category").map((s) => [s.prefix!, s]));
  const proto = byPrefix.get("AP")!; // the assembled-parts sheet: the layout for categories the file has no sheet for
  // Copies are made from the sheet as it is in the template, before it is filled.
  const protoSheetXml = read(proto.file);
  const protoTableXml = read(proto.table!);
  const kept = new Set<string>(["MASTER"]);
  if (opts.keepReferenceSheets) SHEETS.filter((s) => s.kind === "static").forEach((s) => kept.add(s.name));

  // ---- one sheet per category --------------------------------------------
  const masterRows: Array<{ category: string; row: PartCodeRow }> = [];
  let protoUsed = false;
  let nextSheetNo = Math.max(...Object.keys(files).map((f) => Number(f.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1] ?? 0))) + 1;
  let nextTableNo = Math.max(...Object.keys(files).map((f) => Number(f.match(/^xl\/tables\/table(\d+)\.xml$/)?.[1] ?? 0))) + 1;
  // Table ids must be unique in the workbook.
  let nextTableId = Math.max(...Object.keys(files).filter((f) => /^xl\/tables\/table\d+\.xml$/.test(f))
    .map((f) => Number(read(f).match(/<table [^>]*?\bid="(\d+)"/)?.[1] ?? 0))) + 1;
  let nextSheetId = Math.max(...[...wb.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  let nextRid = Math.max(...[...wbRels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1;

  for (const spec of opts.sheets) {
    spec.rows.forEach((row) => masterRows.push({ category: spec.categoryLabel, row }));
    let ms = byPrefix.get(spec.prefix);
    let sheetFile: string;
    let tableFile: string | null | undefined;
    let sheetName: string;

    if (ms && ms.prefix !== "AP") {
      sheetFile = ms.file; tableFile = ms.table; sheetName = ms.name;
    } else if (!protoUsed) {
      // The assembled-parts sheet itself, renamed for this category.
      protoUsed = true;
      ms = proto;
      sheetFile = proto.file; tableFile = proto.table;
      sheetName = spec.sheetName ?? proto.name;
      if (sheetName !== proto.name) wb = wb.replace(`name="${esc(proto.name)}"`, `name="${esc(sheetName)}"`);
    } else {
      // A copy of the assembled-parts sheet.
      ms = proto;
      const n = nextSheetNo++, t = nextTableNo++, sid = nextSheetId++, rid = `rId${nextRid++}`;
      sheetFile = `xl/worksheets/sheet${n}.xml`;
      tableFile = `xl/tables/table${t}.xml`;
      sheetName = spec.sheetName ?? `${spec.prefix}-${spec.categoryLabel}`;
      files[sheetFile] = strToU8(protoSheetXml);
      files[tableFile] = strToU8(protoTableXml
        .replace(/(<table [^>]*?)\bid="\d+"/, `$1id="${nextTableId}"`)
        .replace(/ name="[^"]*"/, ` name="Table_${spec.prefix}"`)
        .replace(/ displayName="[^"]*"/, ` displayName="Table_${spec.prefix}"`));
      nextTableId++;
      write(`xl/worksheets/_rels/sheet${n}.xml.rels`, read(proto.rels!).replace(/Target="\.\.\/tables\/table\d+\.xml"/, `Target="../tables/table${t}.xml"`));
      ct = ct.replace("</Types>",
        `<Override PartName="/${sheetFile}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/${tableFile}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`);
      wbRels = wbRels.replace("</Relationships>",
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
      // After the other category sheets, before the reference sheets.
      const before = wb.match(/<sheet name="Change Log"[^>]*\/>/)?.[0] ?? "</sheets>";
      wb = wb.replace(before, `<sheet name="${esc(sheetName)}" sheetId="${sid}" r:id="${rid}"/>${before}`);
    }
    kept.add(sheetName);

    // ---- rows ----
    const headers = ms.headers ?? {};
    let xml = strFromU8(files[sheetFile]);
    const protoRow = xml.match(/<row r="4"[^>]*>.*?<\/row>/s)![0];
    const footer = [...xml.matchAll(/<row r="(\d+)"[^>]*>.*?<\/row>/gs)].filter((m) => Number(m[1]) >= 5);
    const rows = spec.rows.length ? spec.rows : [null];
    const last = 3 + rows.length;
    const body = rows.map((r, i) => r
      ? fillRow(protoRow, 4 + i, headers, { ...r })
      : protoRow).join("");
    const footerXml = footer.map((m) => shiftRow(m[0], Number(m[1]), Number(m[1]) - 5 + last + 1)).join("");
    xml = xml.replace(/<row r="4"[^>]*>.*<\/sheetData>/s, body + footerXml + "</sheetData>");
    // Footer merges follow the footer.
    xml = xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m0, a, r1, b, r2) =>
      Number(r1) >= 5 ? `<mergeCell ref="${a}${Number(r1) - 5 + last + 1}:${b}${Number(r2) - 5 + last + 1}"/>` : m0);
    xml = xml.split("{{LAST}}").join(String(last))
      .split("{{END}}").join(String(last + (ms.footerRows ?? 0)))
      .split("{{DATE}}").join(`DATE : ${ddmmyyyy(date)}`);
    if (spec.title) {
      xml = xml.replace(/<c r="A1"([^>]*?)(?:\/>|>.*?<\/c>)/s, (_m, attrs: string) => {
        const s = attrs.match(/s="(\d+)"/)?.[1];
        return inlineStr("A1", s, spec.title!);
      });
    }
    files[sheetFile] = strToU8(xml);
    if (tableFile) write(tableFile, read(tableFile).split("{{LAST}}").join(String(last)));
  }

  // ---- MASTER: every part, one list --------------------------------------
  const master = SHEETS.find((s) => s.kind === "master")!;
  {
    let xml = read(master.file);
    const protoRow = xml.match(/<row r="4"[^>]*>.*?<\/row>/s)![0];
    const rows = masterRows.length ? masterRows : [null];
    const last = 3 + rows.length;
    const body = rows.map((r, i) => {
      if (!r) return protoRow;
      // MASTER's S NO. is a plain number in the offline file.
      return fillRow(protoRow, 4 + i, master.headers ?? {}, { ...r.row, category: r.category })
        .replace(new RegExp(`<f>IF\\(\\$C${4 + i}="","",ROW\\(\\)-3\\)</f>`), "");
    }).join("");
    xml = xml.replace(/<row r="4"[^>]*>.*<\/sheetData>/s, body + "</sheetData>");
    xml = xml.split("{{LAST}}").join(String(last)).split("{{TOTAL}}").join(`Total parts: ${masterRows.length}`);
    write(master.file, xml);
    wb = wb.split("{{MASTER_LAST}}").join(String(last));
  }

  // ---- drop the sheets this export does not have ----------------------------
  for (const s of SHEETS) {
    if (kept.has(s.name) || (s.prefix === "AP" && protoUsed)) continue;
    const sheetTag = wb.match(new RegExp(`<sheet name="${esc(s.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" sheetId="\\d+" r:id="(rId\\d+)"\\/>`));
    if (!sheetTag) continue;
    wb = wb.replace(sheetTag[0], "");
    wbRels = wbRels.replace(new RegExp(`<Relationship Id="${sheetTag[1]}"[^>]*\\/>`), "");
    const rels = s.rels && files[s.rels] ? read(s.rels) : "";
    for (const m of rels.matchAll(/Target="\.\.\/([^"]+)"/g)) {
      const part = `xl/${m[1]}`;
      if (part.startsWith("xl/media/")) continue;
      delete files[part];
      const pr = part.replace(/([^/]+)$/, "_rels/$1.rels");
      delete files[pr];
      ct = ct.replace(new RegExp(`<Override PartName="/${part.replace(/[.]/g, "\\.")}"[^>]*\\/>`), "");
    }
    if (s.rels) delete files[s.rels];
    delete files[s.file];
    ct = ct.replace(new RegExp(`<Override PartName="/${s.file.replace(/[.]/g, "\\.")}"[^>]*\\/>`), "");
  }

  write("xl/workbook.xml", wb);
  write("xl/_rels/workbook.xml.rels", wbRels);
  write("[Content_Types].xml", ct);
  return zipSync(files, { level: 6 });
}
