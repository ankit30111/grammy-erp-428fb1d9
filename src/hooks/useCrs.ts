import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BIS_STEPS } from "@/hooks/usePLM";
import { CRS_LISTS, type CrsType, type CrsValue } from "@/lib/crs/crsExport";

/** The CRS of an R&D product: what R&D typed, plus what the ERP already knows. */

const db = supabase as any;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** R&D stage → the CRS STAGE list. */
const STAGE_TO_CRS: Record<number, string> = { 1: "Proposal", 2: "Proposal", 3: "EVT", 4: "DVT", 5: "PVT", 6: "MP" };

export type Stored = Record<string, CrsValue>;

export function useCrsData(productId?: string | null) {
  return useQuery({
    queryKey: ["plm-crs", productId],
    enabled: !!productId,
    queryFn: async () => {
      const [head, vals] = await Promise.all([
        db.from("plm_crs").select("crs_type, updated_at").eq("product_id", productId).maybeSingle(),
        db.from("plm_crs_values").select("field_id, value, remarks").eq("product_id", productId),
      ]);
      if (head.error) throw head.error;
      if (vals.error) throw vals.error;
      const values: Stored = {};
      for (const v of vals.data ?? []) values[v.field_id] = { value: v.value, remarks: v.remarks };
      return { type: (head.data?.crs_type ?? null) as CrsType | null, values };
    },
  });
}

/**
 * What the ERP already knows about the product, so R&D does not type it twice.
 * A value typed in the CRS always wins; clearing it brings this back.
 */
export function erpValues(data: any, type: CrsType, brandName: (letter: string) => string | undefined, preparedBy: string): Stored {
  const p = data.product;
  const out: Stored = {};
  const put = (id: string, value?: string | null, remarks?: string) => { if (value) out[id] = { value, remarks }; };
  put("CRS-DOC-001", "1.0");
  put("CRS-DOC-002", todayIso());
  put("CRS-DOC-003", preparedBy);
  put("CRS-DOC-004", STAGE_TO_CRS[p.stage]);
  const realName = p.name && !/^(na|n\/a|-|tbd)$/i.test(p.name.trim()) ? p.name.trim() : "";
  put("CRS-MOD-001", !realName ? p.product_code : realName.toUpperCase().startsWith(p.product_code.toUpperCase()) ? realName : `${p.product_code} ${realName}`);

  const codes: any[] = data.fgs ?? [];
  const names = [...new Set(codes.map((f) => (f.brand ? brandName(f.brand) ?? f.brand : null)).filter(Boolean) as string[])];
  if (!names.length && p.client) names.push(p.client);
  const options = CRS_LISTS["BRAND"] ?? [];
  const match = names.map((n) => options.find((o) => o.toLowerCase() === n.trim().toLowerCase())).find(Boolean);
  if (match) put("CRS-MOD-002", match, names.length > 1 ? names.join(", ") : undefined);
  else if (names.length) put("CRS-MOD-002", "Other", names.join(", "));
  else if (p.ownership === "GRAMMY") put("CRS-MOD-002", "Grammy");

  if (codes.length) put("CRS-MOD-003", codes.map((f) => (f.brand && brandName(f.brand) ? `${f.part_code} (${brandName(f.brand)})` : f.part_code)).join(", "));
  else if (data.model) put("CRS-MOD-003", data.model.part_code);
  put("CRS-MOD-004", type);
  put("CRS-MOD-006", p.target_launch ? String(p.target_launch).slice(0, 10) : null);
  const bis = BIS_STEPS.find(([k]) => k === p.bis_status)?.[1];
  if (bis && p.bis_status !== "NOT_STARTED") put("CRS-CRT-001", bis);
  return out;
}

export const filled = (v?: CrsValue) => !!(v?.value && String(v.value).trim());

