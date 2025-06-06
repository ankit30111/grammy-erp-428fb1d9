
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, isPast } from "date-fns";

export const OrderFulfillmentWidget = () => {
  // Monthly orders
  const { data: monthlyOrders } = useQuery({
    queryKey: ['monthly-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .gte('created_at', startOfMonth(new Date()).toISOString())
        .lte('created_at', endOfMonth(new Date()).toISOString());
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Order completion rate
  const { data: completionRate } = useQuery({
    queryKey: ['order-completion-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('status')
        .gte('created_at', startOfMonth(new Date()).toISOString())
        .lte('created_at', endOfMonth(new Date()).toISOString());
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const completed = data?.filter(order => order.status === 'COMPLETED').length || 0;
      
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    },
  });

  // Delayed orders
  const { data: delayedOrders } = useQuery({
    queryKey: ['delayed-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('scheduled_date, status')
        .in('status', ['PENDING', 'IN_PROGRESS']);
      
      if (error) throw error;
      
      const delayed = data?.filter(order => 
        isPast(new Date(order.scheduled_date)) && order.status !== 'COMPLETED'
      ).length || 0;
      
      return delayed;
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Orders</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{monthlyOrders || 0}</div>
          <p className="text-xs text-muted-foreground">
            Orders received this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{completionRate}%</div>
          <p className="text-xs text-muted-foreground">
            Orders completed on time
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Delayed Orders</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{delayedOrders || 0}</div>
          <p className="text-xs text-muted-foreground">
            Orders past due date
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
