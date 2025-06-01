
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProductionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionOrder: any;
}

const ProductionDetailsDialog = ({ open, onOpenChange, productionOrder }: ProductionDetailsDialogProps) => {
  // Get BOM data for the product
  const { data: bomData = [] } = useQuery({
    queryKey: ["production-bom", productionOrder?.product_id],
    queryFn: async () => {
      if (!productionOrder?.product_id) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", productionOrder.product_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrder?.product_id && open,
  });

  // Get kit preparation status
  const { data: kitData } = useQuery({
    queryKey: ["production-kit", productionOrder?.id],
    queryFn: async () => {
      if (!productionOrder?.id) return null;
      
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          kit_items(
            *,
            raw_materials!inner(
              material_code,
              name,
              category
            )
          )
        `)
        .eq("production_order_id", productionOrder.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!productionOrder?.id && open,
  });

  const getBOMCategoryStatus = (category: string) => {
    if (!kitData?.kit_items) return "pending";
    
    const categoryItems = kitData.kit_items.filter(
      item => item.raw_materials.category === category
    );
    
    if (categoryItems.length === 0) return "pending";
    
    const allVerified = categoryItems.every(item => item.verified_by_production);
    return allVerified ? "received" : "in_progress";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received': return <Badge variant="default" className="bg-green-100 text-green-800">Received</Badge>;
      case 'in_progress': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case 'pending': return <Badge variant="destructive">Pending</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Group BOM items by category for better organization
  const bomByCategory = bomData.reduce((acc, item) => {
    const category = item.raw_materials.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const mainCategories = ['PCB', 'Transformer', 'Loudspeaker', 'Metal', 'Plastic'];
  const subAssemblyCategories = ['Wire', 'Connector', 'Screw'];
  const accessoryCategories = ['Packaging', 'Sticker', 'Others'];

  const getCategoryItems = (categories: string[]) => {
    return categories.filter(cat => bomByCategory[cat]?.length > 0);
  };

  if (!productionOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Details - {productionOrder.voucher_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Production Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Production Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Product:</span>
                  <div>{productionOrder.products?.name}</div>
                </div>
                <div>
                  <span className="font-medium">Quantity:</span>
                  <div>{productionOrder.quantity} units</div>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <div>{productionOrder.status}</div>
                </div>
                <div>
                  <span className="font-medium">Kit Status:</span>
                  <div>{kitData?.status || 'Not Prepared'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Assembly */}
          {getCategoryItems(mainCategories).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Main Assembly
                  {getStatusIcon(getBOMCategoryStatus('PCB'))}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCategoryItems(mainCategories).map(category => 
                      bomByCategory[category].map((item, index) => (
                        <TableRow key={`${category}-${index}`}>
                          <TableCell className="font-medium">{item.raw_materials.material_code}</TableCell>
                          <TableCell>{item.raw_materials.name}</TableCell>
                          <TableCell>{item.raw_materials.category}</TableCell>
                          <TableCell>{item.quantity * productionOrder.quantity}</TableCell>
                          <TableCell>{getStatusBadge(getBOMCategoryStatus(item.raw_materials.category))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Sub Assembly */}
          {getCategoryItems(subAssemblyCategories).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Sub Assembly
                  {getStatusIcon(getBOMCategoryStatus('Wire'))}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCategoryItems(subAssemblyCategories).map(category => 
                      bomByCategory[category].map((item, index) => (
                        <TableRow key={`${category}-${index}`}>
                          <TableCell className="font-medium">{item.raw_materials.material_code}</TableCell>
                          <TableCell>{item.raw_materials.name}</TableCell>
                          <TableCell>{item.raw_materials.category}</TableCell>
                          <TableCell>{item.quantity * productionOrder.quantity}</TableCell>
                          <TableCell>{getStatusBadge(getBOMCategoryStatus(item.raw_materials.category))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Accessory */}
          {getCategoryItems(accessoryCategories).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Accessory
                  {getStatusIcon(getBOMCategoryStatus('Packaging'))}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCategoryItems(accessoryCategories).map(category => 
                      bomByCategory[category].map((item, index) => (
                        <TableRow key={`${category}-${index}`}>
                          <TableCell className="font-medium">{item.raw_materials.material_code}</TableCell>
                          <TableCell>{item.raw_materials.name}</TableCell>
                          <TableCell>{item.raw_materials.category}</TableCell>
                          <TableCell>{item.quantity * productionOrder.quantity}</TableCell>
                          <TableCell>{getStatusBadge(getBOMCategoryStatus(item.raw_materials.category))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionDetailsDialog;
