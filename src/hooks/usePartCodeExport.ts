import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PartTier } from "@/hooks/usePartCategories";
import { buildPartCodeWorkbook, type PartCodeRow, type PartCodeSheet } from "@/lib/partCodeExport";
import manifest from "@/lib/partCodeExport.manifest.json";

const db = supabase as any;

/** The offline workbook with its part rows taken out, kept with the part documents. */
export const PART_CODE_TEMPLATE = "templates/part-code-master-template.xlsx";
const BUCKET = "raw-material-documents";

const TIER_FILE: Record<PartTier, string> = {
  PURCHASE: "Part Code Master",
  SUB_ASSEMBLED: "Sub-assembly Code Master",
  FINISHED: "Finished Good Code Master",
};
const TIER_ICON: Record<PartTier, string> = { PURCHASE: "📦", SUB_ASSEMBLED: "🔧", FINISHED: "🎵" };

/** B-001 < B-002 < B-010 < E-002A < E-002B */
const byCode = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

async function all<T>(query: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** "475U, 9080B" + more names, without repeating one already there. */
const joinUsedIn = (typed: string | null | undefined, extra: string[]) => {
  const parts = (typed ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set(parts.map((s) => s.toUpperCase()));
  for (const e of extra) if (e && !seen.has(e.trim().toUpperCase())) { parts.push(e.trim()); seen.add(e.trim().toUpperCase()); }
  return parts.join(", ");
};

/**
 * Builds the Excel in the offline part-code format for one kind of part:
 * Purchase Part (MASTER + one sheet per category, as the offline file), Sub-assembly
 * or Finished Good (MASTER + their category sheets in the same layout).
 */
export function usePartCodeExport() {
  const [busy, setBusy] = useState<PartTier | null>(null);

  const exportTier = async (tier: PartTier) => {
    setBusy(tier);
    try {
      const [tpl, cats, parts, bom, brands] = await Promise.all([
        supabase.storage.from(BUCKET).download(PART_CODE_TEMPLATE),
        db.from("part_categories").select("prefix, name, tier").order("prefix"),
        all<any>((f, t) => db.from("parts")
          .select("id, part_code, name, category, specification, used_in_reference, is_active, source_type, brand, model_id, part_vendors ( is_primary, vendors ( name ) )")
          .neq("source_type", "MODEL").order("part_code").range(f, t)),
        all<any>((f, t) => db.from("bom").select("parent_part_id, child_part_id").eq("is_active", true).range(f, t)),
        db.from("brands").select("letter, name"),
      ]);
      if (tpl.error || !tpl.data) throw new Error("The Excel format file is missing. Ask an admin to upload it again.");
      if (cats.error) throw cats.error;

      const byId = new Map(parts.map((p: any) => [p.id, p]));
      const models = new Map<string, any>();
      (await all<any>((f, t) => db.from("parts").select("id, part_code").eq("source_type", "MODEL").range(f, t)))
        .forEach((m) => models.set(m.id, m));
      const brandName = new Map<string, string>((brands.data ?? []).map((b: any) => [b.letter, b.name]));

      // Finished goods each part ends up in, through any sub-assembly.
      const parentsOf = new Map<string, string[]>();
      for (const l of bom) (parentsOf.get(l.child_part_id) ?? parentsOf.set(l.child_part_id, []).get(l.child_part_id)!).push(l.parent_part_id);
      const fgNames = (id: string) => {
        const out = new Set<string>(); const seen = new Set<string>(); const todo = [id];
        while (todo.length) {
          const cur = todo.pop()!;
          for (const p of parentsOf.get(cur) ?? []) {
            if (seen.has(p)) continue; seen.add(p);
            const part: any = byId.get(p);
            if (part?.source_type === "FINISHED_GOOD") out.add((part.name ?? part.part_code).trim());
            else todo.push(p);
          }
        }
        return [...out].sort(byCode);
      };

      const vendorOf = (p: any) => {
        const v = [...(p.part_vendors ?? [])].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))[0];
        return v?.vendors?.name ?? null;
      };
      const rowOf = (p: any): PartCodeRow => {
        const base = { code: p.part_code, name: (p.name ?? "").trim(), specification: p.specification, status: p.is_active === false ? "OBSOLETE" : null };
        if (tier === "FINISHED") {
          return { ...base, usedIn: models.get(p.model_id)?.part_code ?? null, vendor: brandName.get(p.brand) ?? null };
        }
        return { ...base, usedIn: joinUsedIn(p.used_in_reference, fgNames(p.id)) || null, vendor: tier === "PURCHASE" ? vendorOf(p) : null };
      };

      // Every category of this kind gets its sheet, even with no part yet - as in the offline file.
      const tierCats = (cats.data ?? []).filter((c: any) => c.tier === tier);
      const templateOrder = (manifest as any).sheets.map((s: any) => s.prefix).filter(Boolean) as string[];
      tierCats.sort((a: any, b: any) => {
        const ia = templateOrder.indexOf(a.prefix), ib = templateOrder.indexOf(b.prefix);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.prefix.localeCompare(b.prefix);
      });
      const sheets: PartCodeSheet[] = tierCats.map((c: any) => {
        const label = c.name.toUpperCase();
        return {
          prefix: c.prefix,
          categoryLabel: `${c.prefix} - ${label}`,
          sheetName: `${TIER_ICON[tier]} ${c.prefix}-${label}`.slice(0, 31),
          title: `PART CODE DETAIL FOR ${label}`,
          rows: parts.filter((p: any) => p.category === c.prefix).sort((a: any, b: any) => byCode(a.part_code, b.part_code)).map(rowOf),
        };
      });
      // Purchase categories keep the offline sheet's own name and title.
      if (tier === "PURCHASE") sheets.forEach((s) => { delete s.sheetName; delete s.title; });

      const bytes = buildPartCodeWorkbook(new Uint8Array(await tpl.data.arrayBuffer()), {
        sheets, keepReferenceSheets: tier === "PURCHASE", date: new Date(),
      });
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `${TIER_FILE[tier]} ${ddmmyyyy(new Date())}.xlsx` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const n = sheets.reduce((s, x) => s + x.rows.length, 0);
      toast.success(`${TIER_FILE[tier]}: ${n} part codes in ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not build the Excel");
    } finally {
      setBusy(null);
    }
  };

  return { exportTier, busy };
}
