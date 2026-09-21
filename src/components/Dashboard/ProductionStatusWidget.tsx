
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Pause, Play, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRealTimeQuery } from "@/hooks/useRealTimeQuery";
import { useMultiTableRealTime } from "@/hooks/useMultiTableRealTime";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { fetchProductionOrderLines, groupLinesByOrder } from "@/hooks/useProductionOrderLines";

export const ProductionStatusWidget = () => {
  const { scopePlantId } = useDashboardScope();
  const scopeKey = scopePlantId ?? "all";
  const { rows: dynamicLines } = useProductionLinesList(scopePlantId ?? undefined);

  // Current production line status with real-time updates
  const { data: lineStatus } = useRealTimeQuery({
    queryKey: ['production-line-status', scopeKey, dynamicLines.map(l => l.id).join('|')],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      let q = supabase
        .from('production_orders')
        .select(`
          id,
          status,
          voucher_number,
          parts (name)
        `)
        .eq('planned_date', today)
        .in('status', ['PLANNED', 'IN_PRODUCTION']);
      if (scopePlantId) q = q.eq('plant_id', scopePlantId);
      const { data, error } = await q;
      if (error) throw error;

      // Which line(s) each voucher runs on lives in production_order_lines.
      const assignmentRows = await fetchProductionOrderLines((data ?? []).map(o => o.id));
      const assignmentsByOrder = groupLinesByOrder(assignmentRows);

      const lineStatuses = dynamicLines.map(line => {
        const activeOrders = data?.filter(order =>
          (assignmentsByOrder[order.id] ?? []).some(r => r.production_line_id === line.id)
        );

        const currentOrder = activeOrders?.find(order => order.status === 'IN_PRODUCTION');

        return {
          line: line.name,
          status: currentOrder ? 'ACTIVE' : activeOrders?.length ? 'SCHEDULED' : 'IDLE',
          currentProduct: currentOrder?.parts?.name || null,
          voucherNumber: currentOrder?.voucher_number || null
        };
      });

      return lineStatuses;
    },
    tableName: 'production_orders',
  });

  // Pending IQC lots with real-time updates
  const { data: pendingIQC } = useRealTimeQuery({
    queryKey: ['pending-iqc-lots', scopeKey],
    queryFn: async () => {
      let q = supabase
        .from('grn_items')
        .select(`
          id,
          parts (name, part_code),
          grn!inner (grn_number, plant_id)
        `)
        .eq('iqc_outcome', 'PENDING');
      // grn_items carries no plant_id; the plant is on the parent grn.
      if (scopePlantId) q = q.eq('grn.plant_id', scopePlantId);
      const { data, error } = await q;
      if (error) throw error;
      return data?.length || 0;
    },
    tableName: 'grn_items',
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-4 w-4 text-success" />;
      case 'SCHEDULED':
        return <Clock className="h-4 w-4 text-primary" />;
      default:
        return <Pause className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'SCHEDULED':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Production Line Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lineStatus?.map((line) => (
              <div key={line.line} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(line.status)}
                  <div>
                    <div className="font-medium">{line.line}</div>
                    {line.currentProduct && (
                      <div className="text-sm text-muted-foreground">
                        {line.currentProduct} ({line.voucherNumber})
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={getStatusColor(line.status) as any}>
                  {line.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending IQC Lots</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{pendingIQC || 0}</div>
          <p className="text-xs text-muted-foreground">
            Lots awaiting IQC clearance
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
