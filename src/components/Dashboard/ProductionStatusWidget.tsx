
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Pause, Play, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ProductionStatusWidget = () => {
  // Current production line status
  const { data: lineStatus } = useQuery({
    queryKey: ['production-line-status'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          production_lines,
          status,
          voucher_number,
          products (name)
        `)
        .eq('scheduled_date', today)
        .in('status', ['PENDING', 'IN_PROGRESS']);
      
      if (error) throw error;
      
      // Extract unique production lines and their status
      const lines = ['Line 1', 'Line 2', 'Sub Assembly 1', 'Sub Assembly 2'];
      const lineStatuses = lines.map(line => {
        const activeOrders = data?.filter(order => 
          order.production_lines && Object.keys(order.production_lines).includes(line)
        );
        
        const currentOrder = activeOrders?.find(order => order.status === 'IN_PROGRESS');
        
        return {
          line,
          status: currentOrder ? 'ACTIVE' : activeOrders?.length ? 'SCHEDULED' : 'IDLE',
          currentProduct: currentOrder?.products?.name || null,
          voucherNumber: currentOrder?.voucher_number || null
        };
      });
      
      return lineStatuses;
    },
  });

  // Pending IQC lots
  const { data: pendingIQC } = useQuery({
    queryKey: ['pending-iqc-lots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
        .select(`
          id,
          raw_materials (name, material_code),
          grn (grn_number)
        `)
        .eq('iqc_status', 'PENDING');
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-4 w-4 text-green-600" />;
      case 'SCHEDULED':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Pause className="h-4 w-4 text-gray-400" />;
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
          <div className="text-2xl font-bold text-orange-600">{pendingIQC || 0}</div>
          <p className="text-xs text-muted-foreground">
            Lots awaiting IQC clearance
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
