
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SpareOrderItem {
  id: string;
  spare_order_id: string;
  raw_material_id: string;
  quantity: number;
  packed: boolean;
  raw_materials: {
    id: string;
    material_code: string;
    name: string;
    category: string;
  };
  spare_orders: {
    id: string;
    spare_order_number: string;
    customer_id: string;
    customers: {
      id: string;
      customer_code: string;
      name: string;
    };
  };
}

const SpareOrdersPacking = () => {
  const [spareOrderItems, setSpareOrderItems] = useState<SpareOrderItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchSpareOrderItems();
  }, []);

  const fetchSpareOrderItems = async () => {
    const { data, error } = await supabase
      .from('spare_order_items')
      .select(`
        id,
        spare_order_id,
        raw_material_id,
        quantity,
        packed,
        raw_materials:raw_material_id (
          id,
          material_code,
          name,
          category
        ),
        spare_orders:spare_order_id (
          id,
          spare_order_number,
          customer_id,
          customers:customer_id (
            id,
            customer_code,
            name
          )
        )
      `)
      .eq('spare_orders.status', 'PENDING')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching spare order items:', error);
    } else {
      setSpareOrderItems(data || []);
    }
  };

  const handlePackingChange = async (itemId: string, packed: boolean) => {
    const { error } = await supabase
      .from('spare_order_items')
      .update({ packed })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating packing status:', error);
      toast({
        title: "Error",
        description: "Failed to update packing status",
        variant: "destructive"
      });
    } else {
      setSpareOrderItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, packed } : item
        )
      );
      
      toast({
        title: packed ? "Item Packed" : "Item Unpacked",
        description: `Item has been ${packed ? 'marked as packed' : 'unmarked from packed'}`,
      });

      // Check if all items in the order are packed
      const orderItems = spareOrderItems.filter(item => 
        item.spare_order_id === spareOrderItems.find(i => i.id === itemId)?.spare_order_id
      );
      
      const allPacked = orderItems.every(item => 
        item.id === itemId ? packed : item.packed
      );

      if (allPacked && packed) {
        // Move order to spare dispatch
        const spareOrderId = spareOrderItems.find(i => i.id === itemId)?.spare_order_id;
        if (spareOrderId) {
          await supabase
            .from('spare_orders')
            .update({ status: 'PACKED' })
            .eq('id', spareOrderId);
        }
      }
    }
  };

  const getPackingStatusBadge = (packed: boolean) => {
    return packed ? (
      <Badge className="bg-green-100 text-green-800">Packed</Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Spare Orders - Packing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Spare Part</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Packed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spareOrderItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">
                  {item.spare_orders.spare_order_number}
                </TableCell>
                <TableCell>{item.spare_orders.customers.name}</TableCell>
                <TableCell>
                  {item.raw_materials.name} ({item.raw_materials.material_code})
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    {item.quantity}
                  </div>
                </TableCell>
                <TableCell>
                  {getPackingStatusBadge(item.packed)}
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={item.packed}
                    onCheckedChange={(checked) => 
                      handlePackingChange(item.id, checked as boolean)
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SpareOrdersPacking;
