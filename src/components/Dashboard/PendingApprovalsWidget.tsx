import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Package, FileText, TrendingUp, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function PendingApprovalsWidget() {
  const { isAdmin, canAccessModule } = useAuth();
  const visible = isAdmin || canAccessModule("approvals");

  const { data: counts } = useQuery({
    enabled: visible,
    queryKey: ["pending-approvals-counts"],
    queryFn: async () => {
      const [po, capa] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending_approval", "PENDING_APPROVAL", "PENDING"]),
        supabase
          .from("iqc_vendor_capa")
          .select("id", { count: "exact", head: true })
          .eq("capa_status", "AWAITED"),
      ]);
      return {
        po: po.count ?? 0,
        capa: capa.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  if (!visible) return null;

  const items = [
    {
      label: "Purchase Orders",
      icon: Package,
      count: counts?.po ?? 0,
      to: "/approvals?tab=purchase-orders",
    },
    {
      label: "CAPA Approvals",
      icon: FileText,
      count: counts?.capa ?? 0,
      to: "/approvals?tab=capa-approvals",
    },
    {
      label: "CAPA Tracking",
      icon: TrendingUp,
      count: null as number | null,
      to: "/approvals?tab=capa-tracking",
    },
  ];

  return (
    <section className="page-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CheckSquare className="h-3.5 w-3.5" />
          Pending Approvals
        </h2>
        <Link to="/approvals" className="text-xs text-primary hover:underline flex items-center gap-1">
          Open all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <Link key={it.label} to={it.to}>
            <Card className="p-4 hover:bg-muted/40 transition-colors h-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">{it.label}</div>
                  <div className="text-2xl font-bold mt-1">
                    {it.count === null ? "—" : it.count}
                  </div>
                </div>
                <it.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              {it.count !== null && it.count > 0 && (
                <Badge variant="destructive" className="mt-2">Action required</Badge>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}