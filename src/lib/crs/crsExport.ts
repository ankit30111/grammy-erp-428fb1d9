import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import crs from "./crsFields.json";

/**
 * CRS - Customer Requirement & Specification (GA/QMS/RND/DOC/044).
 *
 * The template lives in public/templates and is filled, not rebuilt: the VALUE
 * and Remarks columns of the product's category sheet get the product's values,
 * the other five category sheets are taken out, and every style, pick-list and
 * the Field Dictionary stay as R&D made them.
 */

export const CRS_TEMPLATE_URL = "/templates/crs-template-rev1.0.xlsx";
export const CRS_TYPES = ["Party Speaker", "Soundbar", "Microphone", "BT Speaker", "Tower Speaker", "Trolley Speaker"] as const;
export type CrsType = (typeof CRS_TYPES)[number];

export interface CrsField {
  id: string; section: string; parameter: string; type: string; unit: string; pick: string;
  mandatory: boolean; requiredBy: string; help: string;
  /** "Unit / Test Condition" as the category sheet writes it. */
  condition: string; row: number;
}

const DATA = crs as unknown as {
  revision: string; document: string;
  fields: Record<string, Omit<CrsField, "id" | "condition" | "row">>;
  lists: Record<string, string[]>;
  sheets: Record<CrsType, [string, number, string][]>;
};
export const CRS_REVISION = DATA.revision;
export const CRS_LISTS = DATA.lists;

/** The fields of one category, in the sheet's order. */
export const crsFieldsFor = (type: CrsType): CrsField[] =>
  DATA.sheets[type].map(([id, row, condition]) => ({ id, ...DATA.fields[id], condition, row }));

/** The R&D category of a product → its CRS sheet (PCB and the like have none). */
export function crsTypeForCategory(category?: string | null): CrsType | null {
  const c = (category ?? "").trim().toLowerCase();
  if (!c) return null;
  const direct = CRS_TYPES.find((t) => t.toLowerCase() === c);
  if (direct) return direct;
  if (/sound\s*bar/.test(c)) return "Soundbar";
  if (/trolley/.test(c)) return "Trolley Speaker";
  if (/tower/.test(c)) return "Tower Speaker";
  if (/party/.test(c)) return "Party Speaker";
  if (/mic/.test(c)) return "Microphone";
  if (/bluetooth|\bbt\b|portable/.test(c)) return "BT Speaker";
  return null;
}

export interface CrsValue { value?: string | null; remarks?: string | null }

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 2026-10-10 → Excel day number (the sheet shows it as DD-MM-YYYY). */
const isoToSerial = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000;
};

function cellXml(ref: string, style: string | undefined, type: string, raw: string) {
  const s = style ? ` s="${style}"` : "";
  const v = raw.trim();
  if (!v) return `<c r="${ref}"${s}/>`;
  if (type === "Date") {
    const n = isoToSerial(v);
    if (n != null) return `<c r="${ref}"${s}><v>${n}</v></c>`;
  }
  if ((type === "Integer" || type === "Number") && /^-?\d+(\.\d+)?$/.test(v)) return `<c r="${ref}"${s}><v>${Number(v)}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

/** Puts one cell into a row of the sheet, keeping that cell's style. */
function setCell(xml: string, ref: string, type: string, value: string) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>.*?</c>)`, "s");
  const m = xml.match(re);
  if (m) {
    const style = m[1].match(/\bs="(\d+)"/)?.[1];
    return xml.replace(re, cellXml(ref, style, type, value));
  }
  // No cell yet (the template always has one; this is only a fallback): append to the row.
  const row = ref.replace(/^[A-Z]+/, "");
  return xml.replace(new RegExp(`(<row r="${row}"[^>]*>.*?)(</row>)`, "s"), `$1${cellXml(ref, undefined, type, value)}$2`);
}

export function buildCrsWorkbook(template: Uint8Array, type: CrsType, values: Record<string, CrsValue>): Uint8Array {
  const files = unzipSync(template);
  const read = (p: string) => strFromU8(files[p]);
  const write = (p: string, s: string) => { files[p] = strToU8(s); };

  let wb = read("xl/workbook.xml");
  let rels = read("xl/_rels/workbook.xml.rels");
  let ct = read("[Content_Types].xml");

  const sheetTags = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => ({
    tag: m[0],
    name: m[0].match(/name="([^"]*)"/)![1].replace(/&amp;/g, "&"),
    rid: m[0].match(/r:id="([^"]*)"/)![1],
  }));
  const fileOf = (rid: string) => {
    const t = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*/>`))?.[0].match(/Target="([^"]+)"/)?.[1] ?? "";
    return t.startsWith("/") ? t.slice(1) : `xl/${t}`;
  };

  // ---- fill the product's category sheet ------------------------------------
  const mine = sheetTags.find((s) => s.name === type);
  if (!mine) throw new Error(`The CRS template has no "${type}" sheet.`);
  const file = fileOf(mine.rid);
  let xml = read(file);
  for (const f of crsFieldsFor(type)) {
    const v = values[f.id];
    if (!v) continue;
    if (v.value != null && String(v.value).trim()) xml = setCell(xml, `I${f.row}`, f.type, String(v.value));
    if (v.remarks != null && String(v.remarks).trim()) xml = setCell(xml, `J${f.row}`, "Text", String(v.remarks));
  }
  write(file, xml);

  // ---- take out the other category sheets -----------------------------------
  for (const s of sheetTags) {
    if (s.name === type || !(CRS_TYPES as readonly string[]).includes(s.name)) continue;
    const f = fileOf(s.rid);
    wb = wb.replace(s.tag, "");
    rels = rels.replace(new RegExp(`<Relationship\\b[^>]*Id="${s.rid}"[^>]*/>`), "");
    const sheetRels = f.replace(/([^/]+)$/, "_rels/$1.rels");
    if (files[sheetRels]) {
      for (const m of read(sheetRels).matchAll(/Target="\.\.\/([^"]+)"/g)) {
        const part = `xl/${m[1]}`;
        if (part.startsWith("xl/media/")) continue;
        delete files[part];
        ct = ct.replace(new RegExp(`<Override PartName="/${reEsc(part)}"[^>]*/>`), "");
      }
      delete files[sheetRels];
    }
    delete files[f];
    ct = ct.replace(new RegExp(`<Override PartName="/${reEsc(f)}"[^>]*/>`), "");
    // Names that point only at a removed sheet.
    wb = wb.replace(new RegExp(`<definedName\\b[^>]*>[^<]*'?${reEsc(esc(s.name))}'?![^<]*</definedName>`, "g"), "");
  }
  wb = wb.replace(/<definedNames>\s*<\/definedNames>/, "");

  // ---- open on the filled sheet ----------------------------------------------
  const order = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => m[0].match(/name="([^"]*)"/)![1].replace(/&amp;/g, "&"));
  const idx = order.indexOf(type);
  // localSheetId of the names that are left follow the new order.
  const oldOrder = sheetTags.map((s) => s.name);
  wb = wb.replace(/localSheetId="(\d+)"/g, (_m, n) => `localSheetId="${Math.max(order.indexOf(oldOrder[Number(n)]), 0)}"`);
  wb = /activeTab="\d+"/.test(wb)
    ? wb.replace(/activeTab="\d+"/, `activeTab="${idx}"`)
    : wb.replace(/<workbookView\b/, `<workbookView activeTab="${idx}"`);
  wb = wb.replace(/firstSheet="\d+"/, 'firstSheet="0"');
  for (const s of sheetTags) {
    if (!files[fileOf(s.rid)]) continue;
    const f = fileOf(s.rid);
    let sx = read(f).replace(/\s?tabSelected="1"/g, "");
    if (s.name === type) sx = sx.replace(/<sheetView\b/, '<sheetView tabSelected="1"');
    write(f, sx);
  }
  delete files["xl/calcChain.xml"];
  ct = ct.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, "");
  rels = rels.replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/, "");

  write("xl/workbook.xml", wb);
  write("xl/_rels/workbook.xml.rels", rels);
  write("[Content_Types].xml", ct);
  return zipSync(files, { level: 6 });
}
