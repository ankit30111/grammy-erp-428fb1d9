
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Package, Factory, Clock, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import EnhancedMaterialReceiptView from "./EnhancedMaterialReceiptView";

export default function ScheduledProductions() {
  const [selectedProductionOrder, setSelectedProductionOrder] = useState<string | null>(null);

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["scheduled-production-orders"],
    queryFn: async () => {
      console.log("🔍 Fetching scheduled production orders...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(
            name,
            product_code
          ),
          production_schedules!inner(
            scheduled_date,
            production_line
          )
        `)
        .in("status", ["SCHEDULED", "PENDING", "IN_PROGRESS"])
        .order("scheduled_date", { ascending: true });

      if (error) {
        console.error("❌ Error fetching production orders:", error);
        throw error;
      }

      console.log("📋 Scheduled production orders:", data);
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Fetch BOM data for selected production order
  const { data: bomData = [] } = useQuery({
    queryKey: ["production-bom", selectedProductionOrder],
    queryFn: async () => {
      if (!selectedProductionOrder) return [];
      
      const order = productionOrders.find(po => po.id === selectedProductionOrder);
      if (!order) return [];
      
      console.log("🔍 Fetching BOM for production order:", selectedProductionOrder);
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials (
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", order.product_id);

      if (error) {
        console.error("❌ Error fetching BOM:", error);
        throw error;
      }

      console.log("📋 BOM data fetched:", data);
      return data || [];
    },
    enabled: !!selectedProductionOrder,
  });

  const getRequiredQuantities = (order: any) => {
    const quantities: Record<string, number> = {};
    bomData.forEach((bomItem: any) => {
      quantities[bomItem.raw_materials.id] = bomItem.quantity * order.quantity;
    });
    return quantities;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getKitStatusBadge = (kitStatus: string) => {
    switch (kitStatus) {
      case 'PREPARED':
        return <Badge className="bg-green-100 text-green-800">Kit Ready</Badge>;
      case 'PARTIAL':
        return <Badge variant="secondary">Kit Partial</Badge>;
      case 'NOT_PREPARED':
        return <Badge variant="outline">Kit Pending</Badge>;
      default:
        return <Badge variant="outline">{kitStatus}</Badge>;
    }
  };

  if (selectedProductionOrder) {
    const selectedOrder = productionOrders.find(po => po.id === selectedProductionOrder);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setSelectedProductionOrder(null)}
            className="gap-2"
          >
            ← Back to List
          </Button>
          <Badge variant="outline">
            Production Material Receipt
          </Badge>
        </div>

        {selectedOrder && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  {selectedOrder.voucher_number} - {selectedOrder.products?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-muted-foreground">Product Code:</span>
                    <p className="font-medium">{selectedOrder.products?.product_code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>
                    <p className="font-medium">{selectedOrder.quantity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scheduled Date:</span>
                    <p className="font-medium">{format(new Date(selectedOrder.scheduled_date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <EnhancedMaterialReceiptView
              productionOrderId={selectedProductionOrder}
              bomData={bomData}
              requiredQuantities={getRequiredQuantities(selectedOrder)}
            />
          </>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading scheduled productions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Productions ({productionOrders.length})
            <Badge variant="outline">Material Receipt Tracking</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productionOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Factory className="h-12 w-12 mx-auto mb-4" />
              <p>No scheduled productions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {productionOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-lg">{order.voucher_number}</h3>
                      <p className="text-muted-foreground">{order.products?.name}</p>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(order.status)}
                      {getKitStatusBadge(order.kit_status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Quantity: {order.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(order.scheduled_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Line: {order.production_schedules?.production_line || 'TBD'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{order.status.toLowerCase()}</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProductionOrder(order.id)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Material Receipt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
