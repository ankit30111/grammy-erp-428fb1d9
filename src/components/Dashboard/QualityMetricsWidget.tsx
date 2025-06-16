
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Shield, FileText, XCircle, CheckCircle } from "lucide-react";
import { useRealTimeQuery } from "@/hooks/useRealTimeQuery";
import { useMultiTableRealTime } from "@/hooks/useMultiTableRealTime";

export const QualityMetricsWidget = () => {
  // IQC Status Distribution with real-time updates
  const { data: iqcStatus } = useRealTimeQuery({
    queryKey: ['iqc-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
        .select('iqc_status');
      
      if (error) throw error;
      
      const statusCount = data?.reduce((acc: any, item) => {
        const status = item.iqc_status || 'PENDING';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      const total = data?.length || 0;
      return {
        passed: Math.round(((statusCount?.APPROVED || 0) / total) * 100),
        failed: Math.round(((statusCount?.REJECTED || 0) / total) * 100),
        segregated: Math.round(((statusCount?.SEGREGATED || 0) / total) * 100),
        pending: Math.round(((statusCount?.PENDING || 0) / total) * 100)
      };
    },
    tableName: 'grn_items',
  });

  // PQC Report Upload Rate with real-time updates
  const { data: pqcRate } = useRealTimeQuery({
    queryKey: ['pqc-upload-rate'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: reports, error: reportsError } = await supabase
        .from('pqc_reports')
        .select('id')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      const { data: orders, error: ordersError } = await supabase
        .from('production_orders')
        .select('id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('status', 'COMPLETED');
      
      if (reportsError || ordersError) throw reportsError || ordersError;
      
      const reportsCount = reports?.length || 0;
      const ordersCount = orders?.length || 0;
      
      return ordersCount > 0 ? Math.round((reportsCount / ordersCount) * 100) : 0;
    },
    tableName: 'pqc_reports',
  });

  // Line Rejection Rate with real-time updates
  const { data: rejectionRate } = useRealTimeQuery({
    queryKey: ['line-rejection-rate'],
    queryFn: async () => {
      const { data: rejections, error: rejError } = await supabase
        .from('line_rejections')
        .select('quantity_rejected');
      
      const { data: production, error: prodError } = await supabase
        .from('hourly_production')
        .select('production_units');
      
      if (rejError || prodError) throw rejError || prodError;
      
      const totalRejected = rejections?.reduce((sum, rej) => sum + rej.quantity_rejected, 0) || 0;
      const totalProduced = production?.reduce((sum, prod) => sum + prod.production_units, 0) || 0;
      
      return totalProduced > 0 ? ((totalRejected / totalProduced) * 100).toFixed(2) : "0.00";
    },
    tableName: 'line_rejections',
  });

  // Customer Complaints with real-time updates
  const { data: complaints } = useRealTimeQuery({
    queryKey: ['customer-complaints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_complaints')
        .select('status');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const resolved = data?.filter(c => c.status === 'Closed').length || 0;
      
      return {
        total,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
      };
    },
    tableName: 'customer_complaints',
  });

  // Set up multi-table subscriptions for this widget
  useMultiTableRealTime({
    queryKey: ['iqc-status', 'pqc-upload-rate', 'line-rejection-rate', 'customer-complaints'],
    tables: ['grn_items', 'pqc_reports', 'line_rejections', 'customer_complaints', 'production_orders', 'hourly_production']
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">IQC Pass Rate</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{iqcStatus?.passed || 0}%</div>
          <p className="text-xs text-muted-foreground">
            Materials passed IQC
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PQC Compliance</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{pqcRate || 0}%</div>
          <p className="text-xs text-muted-foreground">
            Reports uploaded (7 days)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Line Rejection Rate</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{rejectionRate}%</div>
          <p className="text-xs text-muted-foreground">
            Production line rejections
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Complaint Resolution</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{complaints?.resolutionRate || 0}%</div>
          <p className="text-xs text-muted-foreground">
            Total complaints: {complaints?.total || 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
