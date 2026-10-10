import { supabase } from "@/integrations/supabase/client";
import { issuePartCode } from "@/hooks/usePartCategories";
import { UNIT_OPTIONS } from "@/lib/units";
import { type Cell, type SheetSpec, writeWorkbook } from "@/lib/xlsxLite";

/**
 * Import / Export of the masters as plain lists: header in row 1, one record a row.
 * An exported list can be changed in Excel and imported again; the import shows
 * what it will do before anything is saved, and the database rules still apply
 * (approvals, rights, codes issued by the database).
 */

const db = supabase as any;

export type ImportKind = "parts" | "customers";
export type Action = "NEW" | "UPDATE" | "SAME" | "ERROR";
export interface PlanRow {
  row: number;            // Excel row number
  action: Action;
  code: string;
  name: string;
  note: string;           // what changes, or the problem
  apply?: () => Promise<string | void>;
  status?: "done" | "failed";
  result?: string;
}

async function all<T>(query: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const byCode = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
const key = (s: unknown) => norm(s).toLowerCase();
const headerKey = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** Finds each wanted column by its header, whatever the order or spacing. */
function columns(header: string[], wanted: Record<string, string[]>) {
  const keys = header.map(headerKey);
  const at: Record<string, number> = {};
  for (const [field, names] of Object.entries(wanted)) {
    at[field] = keys.findIndex((k) => names.some((n) => headerKey(n) === k));
  }
  return at;
}
/** The row that holds the headers: the first with the required column in it. */
function headerRow(rows: string[][], required: string[]) {
  const want = required.map(headerKey);
  const i = rows.slice(0, 10).findIndex((r) => r && want.every((w) => r.some((c) => headerKey(c) === w)));
  if (i < 0) throw new Error(`Row 1 must have the column headers. Missing: ${required.join(", ")}. Download the template to see the layout.`);
  return i;
}

const readMe = (lines: string[]): SheetSpec => ({ name: "Read me", header: ["How to use this file"], rows: lines.map((l) => [l]), widths: [120] });

/* ===================================================================== PARTS */

const PART_COLS = ["Part Code", "Category", "Part Name", "Specification", "Unit", "Sourcing", "Currency", "Unit Price", "Primary Vendor", "Used In", "Remarks"];
const PART_INFO_COLS = ["Type", "Category Name", "Approval", "Active"];
const PART_WIDTHS = [13, 10, 40, 40, 8, 11, 10, 11, 28, 24, 30, 14, 26, 11, 8];
const PART_ALIASES: Record<string, string[]> = {
  code: ["Part Code", "Code", "Part No", "Part No."], category: ["Category", "Prefix", "Category Code"],
  name: ["Part Name", "Name", "Item"], spec: ["Specification", "Spec", "Description"], unit: ["Unit", "UOM", "UoM"],
  sourcing: ["Sourcing", "Sourcing Type"], currency: ["Currency"], price: ["Unit Price", "Price", "Rate"],
  vendor: ["Primary Vendor", "Vendor"], usedIn: ["Used In"], remarks: ["Remarks", "Remark"],
};

async function loadPartsContext() {
  const [cats, parts, vendors] = await Promise.all([
    db.from("part_categories").select("prefix, name, tier, is_active").order("prefix"),
    all<any>((f, t) => db.from("parts")
      .select("id, part_code, name, category, specification, uom, sourcing_type, currency, unit_price, used_in_reference, remarks, approval_status, is_active, part_vendors ( vendor_id, is_primary, vendors ( name ) )")
      .order("part_code").range(f, t)),
    all<any>((f, t) => db.from("vendors").select("id, name, vendor_code, is_active").order("name").range(f, t)),
  ]);
  if (cats.error) throw cats.error;
  return { cats: (cats.data ?? []) as { prefix: string; name: string; tier: string; is_active: boolean }[], parts, vendors };
}

const TIER_LABEL: Record<string, string> = { PURCHASE: "Purchase Part", SUB_ASSEMBLED: "Sub-assembly", FINISHED: "Finished Good" };
const primaryVendor = (p: any) => (p.part_vendors ?? []).find((v: any) => v.is_primary)?.vendors?.name ?? (p.part_vendors?.length === 1 ? p.part_vendors[0].vendors?.name : null);

export async function partsWorkbook(withRows: boolean): Promise<Uint8Array> {
  const { cats, parts, vendors } = await loadPartsContext();
  const tierOf = new Map(cats.map((c) => [c.prefix, c]));
  const rows: Cell[][] = withRows
    ? parts
      .filter((p) => tierOf.get(p.category)?.tier !== "FINISHED")
      .sort((a, b) => byCode(a.part_code, b.part_code))
      .map((p) => {
        const c = tierOf.get(p.category);
        return [p.part_code, p.category, p.name, p.specification, p.uom, p.sourcing_type, p.currency, p.unit_price ?? null,
          primaryVendor(p), p.used_in_reference, p.remarks, TIER_LABEL[c?.tier ?? ""] ?? "", c?.name ?? "", p.approval_status, p.is_active ? "Yes" : "No"];
      })
    : [];
  return writeWorkbook([
    { name: "Parts", header: [...PART_COLS, ...PART_INFO_COLS], rows, widths: PART_WIDTHS, required: [1, 2] },
    readMe([
      "One part a row. Row 1 is the header; keep the column names as they are (the order does not matter).",
      "NEW PART: leave Part Code empty and fill Category and Part Name. The ERP gives the next code of the category (B-245).",
      "CHANGE A PART: keep its Part Code and change the cells. An empty cell leaves that value as it is.",
      "Category: the letter of the category (see the Categories sheet). Finished goods are not imported here: they come from R&D / Models.",
      "Unit: " + UNIT_OPTIONS.join(", ") + ". Set only for a new part; a part's unit is changed on its own page because its stock is kept in it.",
      "Sourcing: LOCAL or IMPORTED. Currency (imported parts): USD, RMB or INR. Unit Price: a number.",
      "Primary Vendor: the vendor's name exactly as in Vendors (see the Vendors sheet). Other vendors of the part stay as they are.",
      "Type, Category Name, Approval and Active are for reading only; the import does not change them.",
      "New parts from someone who is not Management are saved as pending and go to Approvals.",
    ]),
    { name: "Categories", header: ["Category", "Category Name", "Type"], widths: [10, 30, 16],
      rows: cats.filter((c) => c.is_active).map((c) => [c.prefix, c.name, TIER_LABEL[c.tier] ?? c.tier]) },
    { name: "Vendors", header: ["Vendor", "Vendor Code", "Active"], widths: [40, 14, 8],
      rows: vendors.map((v) => [v.name, v.vendor_code, v.is_active ? "Yes" : "No"]) },
  ]);
}

export async function planParts(sheet: string[][]): Promise<PlanRow[]> {
  const hi = headerRow(sheet, ["Category", "Part Name"]);
  const col = columns(sheet[hi], PART_ALIASES);
  const { cats, parts, vendors } = await loadPartsContext();
  const catBy = new Map<string, (typeof cats)[number]>();
  for (const c of cats.filter((c) => c.is_active)) { catBy.set(c.prefix.toUpperCase(), c); catBy.set(key(c.name), c); }
  const partBy = new Map(parts.map((p) => [p.part_code.toUpperCase(), p]));
  const nameInCat = new Map(parts.map((p) => [`${p.category}|${key(p.name)}`, p.part_code]));
  const vendorBy = new Map(vendors.map((v) => [key(v.name), v]));
  const seenCodes = new Set<string>();
  const seenNew = new Map<string, number>();
  const cell = (r: string[], f: string) => (col[f] >= 0 ? norm(r[col[f]]) : "");

  const out: PlanRow[] = [];
  for (let i = hi + 1; i < sheet.length; i++) {
    const r = sheet[i] ?? [];
    if (!r.some((c) => norm(c))) continue;
    const row = i + 1;
    const code = cell(r, "code").toUpperCase();
    const catText = cell(r, "category");
    const name = cell(r, "name");
    const err = (note: string): PlanRow => ({ row, action: "ERROR", code, name, note });

    const catRaw = catText.toUpperCase().split(/\s*[-–]\s*/)[0];
    const cat = catText ? catBy.get(catRaw) ?? catBy.get(key(catText)) : undefined;
    if (catText && !cat) { out.push(err(`Category “${catText}” is not in the list (see the Categories sheet)`)); continue; }

    const unit = cell(r, "unit").toUpperCase();
    if (unit && !UNIT_OPTIONS.includes(unit)) { out.push(err(`Unit “${unit}” is not one of ${UNIT_OPTIONS.join(", ")}`)); continue; }
    let sourcing = cell(r, "sourcing").toUpperCase();
    if (sourcing.startsWith("IMPORT")) sourcing = "IMPORTED";
    if (sourcing && !["LOCAL", "IMPORTED"].includes(sourcing)) { out.push(err(`Sourcing must be LOCAL or IMPORTED, not “${sourcing}”`)); continue; }
    const currency = cell(r, "currency").toUpperCase();
    if (currency && !["USD", "RMB", "INR"].includes(currency)) { out.push(err(`Currency must be USD, RMB or INR, not “${currency}”`)); continue; }
    const priceText = cell(r, "price").replace(/[₹$,\s]/g, "");
    const price = priceText ? Number(priceText) : null;
    if (priceText && !(Number.isFinite(price) && price! >= 0)) { out.push(err(`Unit Price “${cell(r, "price")}” is not a number`)); continue; }
    const vendorName = cell(r, "vendor");
    const vendor = vendorName ? vendorBy.get(key(vendorName)) : undefined;
    if (vendorName && !vendor) { out.push(err(`Vendor “${vendorName}” is not in Vendors (see the Vendors sheet)`)); continue; }

    const spec = cell(r, "spec"), usedIn = cell(r, "usedIn"), remarks = cell(r, "remarks");

    if (code) {
      // ---- change an existing part
      if (seenCodes.has(code)) { out.push(err(`${code} is in the file more than once`)); continue; }
      seenCodes.add(code);
      const p = partBy.get(code);
      if (!p) { out.push(err(`No part has the code ${code}. Leave Part Code empty for a new part.`)); continue; }
      const pc = cats.find((c) => c.prefix === p.category);
      if (pc?.tier === "FINISHED") { out.push(err("Finished goods are changed on their model page, not imported")); continue; }
      if (cat && cat.prefix !== p.category) { out.push(err(`${code} is in category ${p.category}; a code's category cannot change`)); continue; }
      if (unit && unit !== (p.uom ?? "").toUpperCase()) { out.push(err(`Unit is ${p.uom}. Change it on the part's page (its stock is kept in it)`)); continue; }
      const purchase = pc?.tier === "PURCHASE";
      const changes: Record<string, any> = {};
      const notes: string[] = [];
      const diff = (field: string, label: string, next: any, cur: any) => {
        if (next === "" || next === null || next === undefined) return;
        // Extra spaces in what is stored are not a change.
        if (norm(next) === norm(cur)) return;
        changes[field] = next;
        notes.push(`${label}: ${show(cur)} → ${show(next)}`);
      };
      diff("name", "Name", name, p.name);
      diff("specification", "Spec", spec, p.specification);
      diff("used_in_reference", "Used in", usedIn, p.used_in_reference);
      diff("remarks", "Remarks", remarks, p.remarks);
      if (purchase) {
        diff("sourcing_type", "Sourcing", sourcing, p.sourcing_type);
        diff("currency", "Currency", currency, p.currency);
        if (price !== null && Number(price) !== Number(p.unit_price ?? NaN)) {
          changes.unit_price = price; changes.last_price_update = new Date().toISOString();
          notes.push(`Price: ${show(p.unit_price)} → ${price}`);
        }
      } else if (sourcing || currency || price !== null || vendor) {
        notes.push("sourcing, price and vendor are not used for a Sub-assembly");
      }
      const curVendor = (p.part_vendors ?? []).find((v: any) => v.is_primary)?.vendor_id ?? null;
      const vendorChange = purchase && vendor && vendor.id !== curVendor;
      if (vendorChange) notes.push(`Vendor: ${show(primaryVendor(p))} → ${vendor!.name}`);
      if (name && key(name) !== key(p.name)) {
        const other = nameInCat.get(`${p.category}|${key(name)}`);
        if (other && other !== p.part_code) { out.push(err(`${other} already has the name “${name}”`)); continue; }
      }
      if (!Object.keys(changes).length && !vendorChange) {
        out.push({ row, action: "SAME", code, name: p.name, note: notes.join(" · ") });
        continue;
      }
      out.push({
        row, action: "UPDATE", code, name: name || p.name, note: notes.join(" · "),
        apply: async () => {
          if (Object.keys(changes).length) {
            const { error } = await db.from("parts").update(changes).eq("id", p.id);
            if (error) throw error;
          }
          if (vendorChange) await setPrimaryVendor(p.id, vendor!.id, (p.part_vendors ?? []).some((v: any) => v.vendor_id === vendor!.id));
        },
      });
    } else {
      // ---- a new part
      if (!cat) { out.push(err("Category is needed for a new part")); continue; }
      if (cat.tier === "FINISHED") { out.push(err("Finished goods come from R&D / Models, not from an import")); continue; }
      if (!name) { out.push(err("Part Name is needed")); continue; }
      const k = `${cat.prefix}|${key(name)}`;
      const existing = nameInCat.get(k);
      if (existing) { out.push(err(`Already exists as ${existing}. Put ${existing} in Part Code to change it.`)); continue; }
      if (seenNew.has(k)) { out.push(err(`Same name as row ${seenNew.get(k)}`)); continue; }
      seenNew.set(k, row);
      const purchase = cat.tier === "PURCHASE";
      const insert: Record<string, any> = {
        name, category: cat.prefix, uom: unit || "PCS",
        specification: spec || null, used_in_reference: usedIn || null, remarks: remarks || null,
        ...(purchase ? {
          sourcing_type: sourcing || "LOCAL",
          currency: (sourcing || "LOCAL") === "IMPORTED" ? currency || null : null,
          unit_price: price, last_price_update: price !== null ? new Date().toISOString() : null,
        } : {}),
      };
      out.push({
        row, action: "NEW", code: `${cat.prefix}-…`, name,
        note: [TIER_LABEL[cat.tier], cat.name, unit || "PCS", purchase && vendor ? vendor.name : null, purchase && price !== null ? `${currency || "INR"} ${price}` : null].filter(Boolean).join(" · "),
        apply: async () => {
          const partCode = await issuePartCode(cat.prefix);
          const { data, error } = await db.from("parts").insert({ ...insert, part_code: partCode }).select("id, part_code, approval_status").single();
          if (error) throw error;
          if (purchase && vendor) await setPrimaryVendor(data.id, vendor.id, false);
          return data.approval_status === "PENDING" ? `${data.part_code} (sent for approval)` : data.part_code;
        },
      });
    }
  }
  return out;
}

async function setPrimaryVendor(partId: string, vendorId: string, linked: boolean) {
  const off = await db.from("part_vendors").update({ is_primary: false }).eq("part_id", partId).neq("vendor_id", vendorId);
  if (off.error) throw off.error;
  const res = linked
    ? await db.from("part_vendors").update({ is_primary: true }).eq("part_id", partId).eq("vendor_id", vendorId)
    : await db.from("part_vendors").insert({ part_id: partId, vendor_id: vendorId, is_primary: true });
  if (res.error) throw res.error;
}

/* ================================================================= CUSTOMERS */

const CUST_COLS = ["Customer Code", "Customer Name", "Brands", "Contact Person", "Contact Number", "Email", "GST Number", "Address"];
const CUST_INFO_COLS = ["Approval", "Active"];
const CUST_ALIASES: Record<string, string[]> = {
  code: ["Customer Code", "Code"], name: ["Customer Name", "Name", "Customer"], brands: ["Brands", "Brand"],
  person: ["Contact Person", "Contact Person Name"], phone: ["Contact Number", "Phone", "Mobile"], email: ["Email", "E-mail"],
  gst: ["GST Number", "GST", "GSTIN"], address: ["Address"],
};
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadCustomersContext() {
  const [customers, brands] = await Promise.all([
    all<any>((f, t) => db.from("customers")
      .select("id, customer_code, name, contact_person_name, contact_number, email, gst_number, address, approval_status, is_active, customer_brands ( brand )")
      .order("customer_code").range(f, t)),
    db.from("brands").select("letter, name, is_active").order("letter"),
  ]);
  if (brands.error) throw brands.error;
  return { customers, brands: (brands.data ?? []) as { letter: string; name: string; is_active: boolean }[] };
}
const brandsOf = (c: any) => ((c.customer_brands ?? []) as { brand: string }[]).map((b) => b.brand).sort();

export async function customersWorkbook(withRows: boolean): Promise<Uint8Array> {
  const { customers, brands } = await loadCustomersContext();
  const rows: Cell[][] = withRows
    ? customers.sort((a, b) => byCode(a.customer_code, b.customer_code)).map((c) => [
      c.customer_code, c.name, brandsOf(c).join(", "), c.contact_person_name, c.contact_number, c.email, c.gst_number, c.address,
      c.approval_status, c.is_active ? "Yes" : "No"])
    : [];
  return writeWorkbook([
    { name: "Customers", header: [...CUST_COLS, ...CUST_INFO_COLS], rows, widths: [14, 34, 14, 22, 16, 28, 18, 48, 12, 8], required: [1, 6] },
    readMe([
      "One customer a row. Row 1 is the header; keep the column names as they are (the order does not matter).",
      "NEW CUSTOMER: leave Customer Code empty and fill Customer Name and GST Number. The ERP gives the next code (CUST017).",
      "CHANGE A CUSTOMER: keep its Customer Code and change the cells. An empty cell leaves that value as it is.",
      "Brands: two-letter brand codes separated by commas (PH, AW) or the brand names (see the Brands sheet). A brand not in the list is added on the Customers page first.",
      "GST Number: 15 characters, e.g. 07AAACG1234A1Z5.",
      "Bank details and documents are not in this file; they are kept on the customer's page.",
      "Approval and Active are for reading only; the import does not change them.",
    ]),
    { name: "Brands", header: ["Brand Code", "Brand"], widths: [12, 30], rows: brands.filter((b) => b.is_active).map((b) => [b.letter, b.name]) },
  ]);
}

export async function planCustomers(sheet: string[][]): Promise<PlanRow[]> {
  const hi = headerRow(sheet, ["Customer Name"]);
  const col = columns(sheet[hi], CUST_ALIASES);
  const { customers, brands } = await loadCustomersContext();
  const custBy = new Map(customers.map((c) => [c.customer_code.toUpperCase(), c]));
  const nameBy = new Map(customers.map((c) => [key(c.name), c.customer_code]));
  const brandBy = new Map<string, string>();
  for (const b of brands.filter((b) => b.is_active)) { brandBy.set(b.letter.toUpperCase(), b.letter); brandBy.set(key(b.name), b.letter); }
  const cell = (r: string[], f: string) => (col[f] >= 0 ? norm(r[col[f]]) : "");
  const seenCodes = new Set<string>();
  const seenNames = new Map<string, number>();
  // New codes are handed out in file order, after the highest code there is.
  let nextNo = Math.max(0, ...customers.map((c) => Number(c.customer_code.replace(/\D/g, "")) || 0)) + 1;

  const out: PlanRow[] = [];
  for (let i = hi + 1; i < sheet.length; i++) {
    const r = sheet[i] ?? [];
    if (!r.some((c) => norm(c))) continue;
    const row = i + 1;
    const code = cell(r, "code").toUpperCase();
    const name = cell(r, "name");
    const err = (note: string): PlanRow => ({ row, action: "ERROR", code, name, note });

    const brandText = cell(r, "brands");
    const tokens = brandText ? brandText.split(/[,;/|]+/).map(norm).filter(Boolean) : [];
    const unknown = tokens.filter((t) => !brandBy.has(t.toUpperCase()) && !brandBy.has(key(t)));
    if (unknown.length) { out.push(err(`Brand ${unknown.map((u) => `“${u}”`).join(", ")} is not in the list. Add it on the Customers page first.`)); continue; }
    const brandCodes = [...new Set(tokens.map((t) => brandBy.get(t.toUpperCase()) ?? brandBy.get(key(t))!))].sort();
    const gst = cell(r, "gst").toUpperCase().replace(/\s/g, "");
    if (gst && !GST_RE.test(gst)) { out.push(err(`GST Number “${gst}” is not a valid GSTIN`)); continue; }
    const email = cell(r, "email");
    if (email && !EMAIL_RE.test(email)) { out.push(err(`Email “${email}” is not valid`)); continue; }
    const person = cell(r, "person"), phone = cell(r, "phone"), address = cell(r, "address");

    if (code) {
      if (seenCodes.has(code)) { out.push(err(`${code} is in the file more than once`)); continue; }
      seenCodes.add(code);
      const c = custBy.get(code);
      if (!c) { out.push(err(`No customer has the code ${code}. Leave Customer Code empty for a new customer.`)); continue; }
      if (name && key(name) !== key(c.name) && nameBy.has(key(name))) { out.push(err(`${nameBy.get(key(name))} already has the name “${name}”`)); continue; }
      const changes: Record<string, any> = {};
      const notes: string[] = [];
      const diff = (field: string, label: string, next: string, cur: any) => {
        if (!next || next === norm(cur)) return;
        changes[field] = next; notes.push(`${label}: ${show(cur)} → ${next}`);
      };
      diff("name", "Name", name, c.name);
      diff("contact_person_name", "Contact", person, c.contact_person_name);
      diff("contact_number", "Phone", phone, c.contact_number);
      diff("email", "Email", email, c.email);
      diff("gst_number", "GST", gst, c.gst_number);
      diff("address", "Address", address, c.address);
      const cur = brandsOf(c);
      const brandChange = tokens.length > 0 && cur.join(",") !== brandCodes.join(",");
      if (brandChange) notes.push(`Brands: ${cur.join(", ") || "—"} → ${brandCodes.join(", ")}`);
      if (!Object.keys(changes).length && !brandChange) { out.push({ row, action: "SAME", code, name: c.name, note: "" }); continue; }
      out.push({
        row, action: "UPDATE", code, name: name || c.name, note: notes.join(" · "),
        apply: async () => {
          if (Object.keys(changes).length) {
            const { error } = await db.from("customers").update(changes).eq("id", c.id);
            if (error) throw error;
          }
          if (brandChange) {
            const { error } = await db.rpc("customer_set_brands", { p_customer: c.id, p_brands: brandCodes });
            if (error) throw error;
          }
        },
      });
    } else {
      if (!name) { out.push(err("Customer Name is needed")); continue; }
      if (nameBy.has(key(name))) { out.push(err(`Already exists as ${nameBy.get(key(name))}. Put that code in Customer Code to change it.`)); continue; }
      if (!gst) { out.push(err("GST Number is needed for a new customer")); continue; }
      if (seenNames.has(key(name))) { out.push(err(`Same name as row ${seenNames.get(key(name))}`)); continue; }
      seenNames.set(key(name), row);
      const newCode = `CUST${String(nextNo++).padStart(3, "0")}`;
      out.push({
        row, action: "NEW", code: newCode, name,
        note: [brandCodes.join(", "), person, phone, gst].filter(Boolean).join(" · "),
        apply: async () => {
          const { data, error } = await db.from("customers").insert({
            customer_code: newCode, name, contact_person_name: person || null, contact_number: phone || null,
            email: email || null, gst_number: gst, address: address || null,
          }).select("id, customer_code, approval_status").single();
          if (error) throw error;
          if (brandCodes.length) {
            const { error: e2 } = await db.rpc("customer_set_brands", { p_customer: data.id, p_brands: brandCodes });
            if (e2) throw e2;
          }
          return data.approval_status === "PENDING" ? `${data.customer_code} (sent for approval)` : data.customer_code;
        },
      });
    }
  }
  return out;
}

/* =================================================================== VENDORS */

export async function vendorsWorkbook(): Promise<Uint8Array> {
  const vendors = await all<any>((f, t) => db.from("vendors")
    .select("vendor_code, name, contact_person_name, contact_designation, contact_number, email, gst_number, location, address, supplies, approval_status, is_active")
    .order("vendor_code").range(f, t));
  return writeWorkbook([{
    name: "Vendors",
    header: ["Vendor Code", "Vendor", "Contact Person", "Designation", "Contact Number", "Email", "GST Number", "Location", "Address", "Supplies", "Approval", "Active"],
    widths: [12, 36, 22, 16, 16, 28, 18, 16, 48, 30, 12, 8],
    rows: vendors.sort((a, b) => byCode(a.vendor_code ?? "", b.vendor_code ?? "")).map((v) => [
      v.vendor_code, v.name, v.contact_person_name, v.contact_designation, v.contact_number, v.email, v.gst_number,
      v.location, v.address, v.supplies, v.approval_status, v.is_active ? "Yes" : "No"]),
  }]);
}
