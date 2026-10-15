import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useBomTree, type BomTreeNode } from "@/hooks/useBOM";
import { type BomSheetLine, buildBomSheet } from "@/lib/bomSheet";
import { ddmmyyyy, downloadBytes } from "@/lib/xlsxLite";

const db = supabase as any;
const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Downloads this product's BOM as one Excel sheet in the offline BOM layout.
 * Sub-assemblies are opened underneath their line, with quantities per product.
 */
export function DownloadBomButton({ part }: { part: { id: string; part_code: string; name: string; model_version?: string | null } }) {
  const { tree, isLoading } = useBomTree(part.id);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!tree.length) return toast.error(`${part.part_code} has no bill of materials yet`);
    setBusy(true);
    try {
      const ids = new Set<string>();
      const walk = (ns: BomTreeNode[]) => ns.forEach((n) => { ids.add(n.part_id); walk(n.children); });
      walk(tree);
      const [pv, ver] = await Promise.all([
        db.from("part_vendors").select("part_id, is_primary, vendors ( name, contact_person_name, contact_number )").in("part_id", [...ids]),
        db.from("item_versions").select("version, released_at").eq("item_id", part.id).eq("status", "RELEASED")
          .order("released_at", { ascending: false }).limit(1),
      ]);
      if (pv.error) throw pv.error;
      const vendorOf = new Map<string, any>();
      for (const r of pv.data ?? []) if (!vendorOf.has(r.part_id) || r.is_primary) vendorOf.set(r.part_id, r.vendors);

      const lines: BomSheetLine[] = [];
      const add = (ns: BomTreeNode[], prefix: string, perParent: number | null, level: number) =>
        ns.forEach((n, i) => {
          const sno = prefix ? `${prefix}.${i + 1}` : String(i + 1);
          const qps = n.bulk || perParent === null ? null : round(Number(n.quantity) * perParent);
          const sub = n.children.length > 0;
          const v = sub ? null : vendorOf.get(n.part_id);
          lines.push({ sno, level, part_code: n.part_code, name: n.name, qps, subassembly: sub,
                       vendor: v?.name ?? null, contact_person: v?.contact_person_name ?? null, contact_number: v?.contact_number ?? null });
          if (sub) add(n.children, sno, qps, level + 1);
        });
      add(tree, "", 1, 0);

      const version = ver.data?.[0]?.version ?? part.model_version ?? null;
      const bytes = buildBomSheet({
        title: `BOM ${part.part_code}`, version: version ? `VER${version}` : "", sheetName: part.part_code,
        date: ddmmyyyy(), lines,
      });
      downloadBytes(bytes, `BOM ${part.part_code} ${ddmmyyyy()}.xlsx`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not make the BOM");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy || isLoading}>
      <Download /> {busy ? "Preparing…" : "Download BOM"}
    </Button>
  );
}
