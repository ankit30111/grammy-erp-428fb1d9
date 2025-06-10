
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBOMByProduct } from "@/hooks/useBOM";
import { useInventory } from "@/hooks/useInventory";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";

interface ProductionVoucherBOMDisplayProps {
  productId: string;
  requiredQuantity: number;
}

const ProductionVoucherBOMDisplay = ({ productId, requiredQuantity }: ProductionVoucherBOMDisplayProps) => {
  const { data: bomData } = useBOMByProduct(productId);
  const { data: inventory } = useInventory();

  // Organize BOM by sections
  const organizedBOM = bomData?.reduce((acc, item) => {
    const section = item.bom_type || 'main_assembly';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const getSectionTitle = (section: string) => {
    switch (section) {
      case 'main_assembly': return 'Main Assembly';
      case 'sub_assembly': return 'Sub Assembly';
      case 'accessories': return 'Accessories';
      default: return section.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'main_assembly': return <Package className="h-5 w-5" />;
      case 'sub_assembly': return <Package className="h-5 w-5" />;
      case 'accessories': return <Package className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(organizedBOM).map(([section, items]) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getSectionIcon(section)}
              {getSectionTitle(section)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Dispatched</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => {
                  const stockItem = inventory?.find(inv => inv.raw_material_id === item.raw_material_id);
                  const available = stockItem?.quantity || 0;
                  const required = item.quantity * requiredQuantity;
                  const dispatched = 0; // This would come from material movements
                  const pending = Math.max(0, required - available - dispatched);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>{item.raw_materials?.name}</TableCell>
                      <TableCell>{required}</TableCell>
                      <TableCell>{available}</TableCell>
                      <TableCell>{dispatched}</TableCell>
                      <TableCell>
                        {pending > 0 ? (
                          <span className="text-red-600 font-medium">{pending}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pending > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Short
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Ready
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProductionVoucherBOMDisplay;
