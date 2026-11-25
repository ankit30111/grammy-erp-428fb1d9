import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CAPA_STATUS, type ItemPlan, levelLabel } from "@/hooks/useInspectionFlags";
import { cn } from "@/lib/utils";

const n = (v: number) => Number(v).toLocaleString("en-IN");

/**
 * What IQC must check on one GRN line: the inspection level, how many pieces to take, and the
 * accept / reject numbers. A flagged part shows why its inspection is raised. Nothing here blocks.
 */
export function SamplePlanBox({ entry }: { entry?: ItemPlan }) {
  if (!entry) return null;
  const { flag, plan } = entry;
  const same = plan.major.n === plan.minor.n;
  const st = flag ? CAPA_STATUS[flag.capa_status] : null;
  return (
    <div className={cn("space-y-1.5 rounded-md border p-3 text-sm", flag ? "border-warning/50 bg-warning-wash" : "bg-muted/40")}>
      <div className="flex flex-wrap items-center gap-2">
        {flag ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="font-medium">
          {flag ? "Raised inspection" : "Normal inspection"} · level {levelLabel(plan.level)}
        </span>
        {st && <Badge variant={st.tone}>{st.label}</Badge>}
        {flag && !flag.level && <span className="text-xs text-warning">Quality has not chosen the level yet: inspect at G2 meanwhile.</span>}
      </div>
      {plan.every_piece ? (
        <p>Lot {n(plan.lot)}: <strong>check every piece</strong> and reject each defective one.</p>
      ) : (
        <p>
          Lot {n(plan.lot)}: <strong>check {n(plan.sample)} pieces</strong>.{" "}
          Major defects (AQL {Number(plan.major.aql).toFixed(1)}){same ? "" : ` on ${n(plan.major.n)}`}: accept {plan.major.ac}, reject {plan.major.re}.{" "}
          Minor defects (AQL {Number(plan.minor.aql).toFixed(1)}){same ? "" : ` on ${n(plan.minor.n)}`}: accept {plan.minor.ac}, reject {plan.minor.re}.
        </p>
      )}
      {flag?.reason && <p className="text-xs text-muted-foreground">Why: {flag.reason}</p>}
    </div>
  );
}
