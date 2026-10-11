import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useBrands } from "@/hooks/usePartCategories";
import { type Stored, erpValues, filled, useCrsData } from "@/hooks/useCrs";
import { cn } from "@/lib/utils";
import { ddmmyyyy, downloadBytes } from "@/lib/xlsxLite";
import { CRS_TEMPLATE_URL, buildCrsWorkbook, crsFieldsFor, crsTypeForCategory } from "@/lib/crs/crsExport";

const db = supabase as any;

/** The model's R&D product and brand codes: what the CRS is filled from. */
function useModelProduct(modelId?: string | null) {
  return useQuery({
    queryKey: ["model-plm", modelId],
    enabled: !!modelId,
    queryFn: async () => {
      const { data: model, error } = await db.from("parts").select("id, part_code, plm_product_id").eq("id", modelId).maybeSingle();
      if (error) throw error;
      if (!model?.plm_product_id) return { model, product: null, fgs: [] };
      const [prod, fgs] = await Promise.all([
        db.from("plm_products").select("*").eq("id", model.plm_product_id).maybeSingle(),
        db.from("parts").select("id, part_code, brand").eq("model_id", model.id).eq("is_active", true).order("part_code"),
      ]);
      if (prod.error) throw prod.error;
      return { model, product: prod.data, fgs: fgs.data ?? [] };
    },
  });
}

/**
 * CRS button for the Documents of a finished good. The CRS is R&D's, on the
 * model's R&D product; here it is read and downloaded, and changed in R&D.
 */
export function PartCrsButton({ modelId }: { modelId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const { userProfile } = useAuth() as any;
  const { brands } = useBrands();
  const { data: ctx } = useModelProduct(modelId);
  const product = ctx?.product;
  const { data: crs } = useCrsData(product?.id);
  const type = crs?.type ?? crsTypeForCategory(product?.category);
  const stored = useMemo(() => crs?.values ?? {}, [crs]);
  const hasCrs = Object.values(stored).some(filled);

  const values: Stored = useMemo(() => {
    if (!product || !type) return {};
    const auto = erpValues({ product, fgs: ctx?.fgs, model: ctx?.model }, type, (l) => brands.find((b) => b.letter === l)?.name, userProfile?.full_name ?? "");
    const out: Stored = {};
    for (const f of crsFieldsFor(type)) {
      const s = stored[f.id], a = auto[f.id];
      out[f.id] = { value: filled(s) ? s.value : a?.value ?? "", remarks: s?.remarks?.trim() ? s.remarks : a?.remarks ?? "" };
    }
    return out;
  }, [product, type, stored, ctx, brands, userProfile?.full_name]);

  if (!modelId) return null;
  if (!product || !type || !hasCrs) {
    return (
      <span title={product ? "R&D has not filled the CRS yet" : "This model has no R&D product"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" /> CRS <span className="text-destructive">missing</span>
      </span>
    );
  }

  const fields = crsFieldsFor(type);
  const mandatory = fields.filter((f) => f.mandatory);
  const missing = mandatory.filter((f) => !filled(values[f.id])).length;
  const shown = fields.filter((f) => showEmpty || filled(values[f.id]) || values[f.id]?.remarks);
  const sections = [...new Set(shown.map((f) => f.section))];

  const exportCrs = async () => {
    try {
      const res = await fetch(CRS_TEMPLATE_URL);
      if (!res.ok) throw new Error("Could not load the CRS template");
      downloadBytes(buildCrsWorkbook(new Uint8Array(await res.arrayBuffer()), type, values), `CRS ${product.product_code} ${type} ${ddmmyyyy()}.xlsx`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet /> CRS
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(94vw,1000px)] max-w-none flex-col gap-3">
          <DialogHeader className="pr-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <DialogTitle>{product.product_code} · CRS · {type}</DialogTitle>
                <DialogDescription>
                  {missing ? `${missing} of ${mandatory.length} mandatory fields empty. ` : "All mandatory fields filled. "}
                  R&amp;D keeps it up to date.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Empty fields
                </label>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/rnd/products/${encodeURIComponent(product.product_code)}?tab=crs`}>Edit in R&amp;D</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={exportCrs}><Download /> Excel</Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {sections.map((s) => (
              <section key={s} className="rounded-md border">
                <h3 className="border-b bg-muted/40 px-3 py-1.5 text-sm font-semibold">{s}</h3>
                <dl className="divide-y">
                  {shown.filter((f) => f.section === s).map((f) => {
                    const v = values[f.id];
                    const value = String(v?.value ?? "");
                    return (
                      <div key={f.id} className="grid gap-1 px-3 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <dt className="text-muted-foreground">
                          {f.parameter}{f.mandatory && <span className="text-destructive"> *</span>}
                        </dt>
                        <dd className={cn(!value && "text-muted-foreground")}>
                          {value ? (f.type === "Date" ? value.split("-").reverse().join("-") : value) : "—"}
                          {value && f.unit && ` ${f.unit}`}
                          {v?.remarks && <span className="text-muted-foreground"> · {v.remarks}</span>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
