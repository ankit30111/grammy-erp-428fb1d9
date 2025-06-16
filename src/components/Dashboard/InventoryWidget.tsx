
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package2, AlertTriangle, ShoppingCart, Truck } from "lucide-react";
import { useRealTimeQuery } from "@/hooks/useRealTimeQuery";
import { useMultiTableRealTime } from "@/hooks/useMultiTableRealTime";
import { useQuery } from "@tanstack/react-query";

export const InventoryWidget = () => {
  // Live inventory value with real-time updates
  const { data: inventoryValue } = useRealTimeQuery({
    queryKey: ['inventory-value'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('quantity');
      
      if (error) throw error;
      
      const totalUnits = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      return totalUnits;
    },
    tableName: 'inventory',
  });

  // Material shortages with real-time updates
  const { data: shortages } = useRealTimeQuery({
    queryKey: ['material-shortages-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_shortages_calculated')
        .select('shortage_quantity')
        .gt('shortage_quantity', 0);
      
      if (error) throw error;
      return data?.length || 0;
    },
    tableName: 'material_shortages_calculated',
  });

  // Open POs with real-time updates
  const { data: openPOs } = useRealTimeQuery({
    queryKey: ['open-pos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id')
        .in('status', ['PENDING', 'SENT']);
      
      if (error) throw error;
      return data?.length || 0;
    },
    tableName: 'purchase_orders',
  });

  // Pending GRNs with real-time updates
  const { data: pendingGRNs } = useRealTimeQuery({
    queryKey: ['pending-grns-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn')
        .select('id')
        .eq('status', 'PENDING');
      
      if (error) throw error;
      return data?.length || 0;
    },
    tableName: 'grn',
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
          <Package2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inventoryValue?.toLocaleString() || 0}</div>
          <p className="text-xs text-muted-foreground">
            Total units in stock
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Material Shortages</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{shortages || 0}</div>
          <p className="text-xs text-muted-foreground">
            Active shortages
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open POs</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{openPOs || 0}</div>
          <p className="text-xs text-muted-foreground">
            Pending purchase orders
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending GRNs</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{pendingGRNs || 0}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting receipt
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
