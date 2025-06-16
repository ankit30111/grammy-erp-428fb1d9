
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/ui/bar-chart";
import { supabase } from "@/integrations/supabase/client";
import { Factory, TrendingUp, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useRealTimeQuery } from "@/hooks/useRealTimeQuery";
import { useMultiTableRealTime } from "@/hooks/useMultiTableRealTime";

export const ProductionOverviewWidget = () => {
  // Monthly production by category with real-time updates
  const { data: monthlyProduction } = useRealTimeQuery({
    queryKey: ['monthly-production'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          quantity,
          scheduled_date,
          status,
          products!inner(category)
        `)
        .eq('status', 'COMPLETED')
        .gte('scheduled_date', startOfMonth(new Date()).toISOString())
        .lte('scheduled_date', endOfMonth(new Date()).toISOString());
      
      if (error) throw error;
      
      // Group by category
      const grouped = data?.reduce((acc: any, order: any) => {
        const category = order.products?.category || 'Other';
        acc[category] = (acc[category] || 0) + order.quantity;
        return acc;
      }, {});
      
      return Object.entries(grouped || {}).map(([category, quantity]) => ({
        category,
        quantity
      }));
    },
    tableName: 'production_orders',
  });

  // Production efficiency by line with real-time updates
  const { data: lineEfficiency } = useRealTimeQuery({
    queryKey: ['line-efficiency'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hourly_production')
        .select(`
          production_units,
          efficiency_percentage,
          production_orders!inner(
            production_lines,
            scheduled_date
          )
        `)
        .gte('production_orders.scheduled_date', format(new Date(), 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Calculate average efficiency by line
      const lineStats = data?.reduce((acc: any, record: any) => {
        const lines = record.production_orders?.production_lines || {};
        Object.keys(lines).forEach(line => {
          if (!acc[line]) acc[line] = { total: 0, count: 0 };
          acc[line].total += record.efficiency_percentage;
          acc[line].count += 1;
        });
        return acc;
      }, {});
      
      return Object.entries(lineStats || {}).map(([line, stats]: [string, any]) => ({
        line,
        efficiency: Math.round(stats.total / stats.count)
      }));
    },
    tableName: 'hourly_production',
  });

  // Set up multi-table subscriptions for this widget
  useMultiTableRealTime({
    queryKey: ['monthly-production', 'line-efficiency'],
    tables: ['production_orders', 'hourly_production']
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Monthly Production by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyProduction?.length ? (
            <BarChart
              data={monthlyProduction}
              index="category"
              categories={["quantity"]}
              colors={["blue"]}
              valueFormatter={(value) => `${value} units`}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No production data for this month
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Production Line Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineEfficiency?.length ? (
            <div className="space-y-3">
              {lineEfficiency.map((line) => (
                <div key={line.line} className="flex items-center justify-between">
                  <span className="font-medium">{line.line}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${line.efficiency}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{line.efficiency}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No efficiency data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
