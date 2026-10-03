import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/hooks/usePLM";

/** On a finished good: the R&D product it belongs to and where that product stands. */
export function PartProductLink({ part }: { part: { plm_product_id?: string | null; source_type?: string | null } }) {
  const { data: p } = useQuery({
    queryKey: ["plm-product-of-part", part.plm_product_id],
    enabled: !!part.plm_product_id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("plm_products").select("product_code, name, stage").eq("id", part.plm_product_id).maybeSingle();
      return data as { product_code: string; name: string; stage: number } | null;
    },
  });
  if (part.source_type !== "FINISHED_GOOD") return null;
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-muted-foreground">R&amp;D product</div>
      {!part.plm_product_id ? (
        <p className="text-sm text-warning">Not linked to an R&amp;D product. Link it from the product's page in R&amp;D.</p>
      ) : p ? (
        <p className="text-sm">
          <Link className="font-mono underline-offset-2 hover:underline" to={`/rnd/products/${encodeURIComponent(p.product_code)}`}>{p.product_code}</Link>
          {" "}— {p.name} · stage {p.stage} {STAGES[p.stage - 1]?.name}
          {p.stage < 5 && <span className="text-muted-foreground"> · cannot be built yet</span>}
          {p.stage === 5 && <span className="text-muted-foreground"> · pilot builds only</span>}
        </p>
      ) : null}
    </div>
  );
}
