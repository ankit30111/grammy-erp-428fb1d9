
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Truck, FileText, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PackedSpareOrder {
  id: string;
  spare_order_number: string;
  customer_id: string;
  order_date: string;
  status: string;
  notes?: string;
  customers: {
    id: string;
    customer_code: string;
    name: string;
  };
  spare_order_items: Array<{
    id: string;
    raw_material_id: string;
    quantity: number;
    raw_materials: {
      id: string;
      material_code: string;
      name: string;
      category: string;
    };
  }>;
}

const SpareDispatch = () => {
  const [packedOrders, setPackedOrders] = useState<PackedSpareOrder[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchPackedSpareOrders();
  }, []);

  const fetchPackedSpareOrders = async () => {
    const { data, error } = await supabase
      .from('spare_orders')
      .select(`
        id,
        spare_order_number,
        customer_id,
        order_date,
        status,
        notes,
        customers:customer_id (
          id,
          customer_code,
          name
        ),
        spare_order_items (
          id,
          raw_material_id,
          quantity,
          raw_materials:raw_material_id (
            id,
            material_code,
            name,
            category
          )
        )
      `)
      .eq('status', 'PACKED')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching packed spare orders:', error);
    } else {
      setPackedOrders(data || []);
    }
  };

  const handleGenerateBill = async (orderId: string) => {
    try {
      // Update order status to DISPATCHED
      const { error } = await supabase
        .from('spare_orders')
        .update({ status: 'DISPATCHED' })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Bill Generated",
        description: "Spare order has been marked as dispatched and bill generated",
      });

      // Refresh the list
      fetchPackedSpareOrders();
    } catch (error) {
      console.error('Error generating bill:', error);
      toast({
        title: "Error",
        description: "Failed to generate bill",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PACKED': return 'bg-blue-100 text-blue-800';
      case 'DISPATCHED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Spare Dispatch & Billing</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Packed Spare Orders Ready for Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packedOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.spare_order_number}</TableCell>
                  <TableCell>{order.customers.name}</TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {order.spare_order_items.length} items
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleGenerateBill(order.id)}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <FileText className="h-4 w-4" />
                      Generate Bill
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpareDispatch;
