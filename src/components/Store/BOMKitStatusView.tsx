
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BOMKitStatusViewProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrder: any;
  onComponentSent: (component: string) => void;
  sentComponents: string[];
}

const BOMKitStatusView = ({ 
  isOpen, 
  onClose, 
  productionOrder, 
  onComponentSent, 
  sentComponents 
}: BOMKitStatusViewProps) => {
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const { data: bomItems = [] } = useQuery({
    queryKey: ["bom-details", productionOrder?.product_id],
    queryFn: async () => {
      if (!productionOrder?.product_id) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(
            id,
            name,
            material_code
          )
        `)
        .eq("product_id", productionOrder.product_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrder?.product_id && isOpen,
  });

  const groupedBOM = {
    sub_assembly: bomItems.filter(item => item.bom_type === 'sub_assembly'),
    accessory: bomItems.filter(item => item.bom_type === 'accessory'),
    main_assembly: bomItems.filter(item => item.bom_type === 'main_assembly'),
  };

  const handleQuantityChange = (materialCode: string, value: string) => {
    setIssuedQuantities(prev => ({
      ...prev,
      [materialCode]: parseInt(value) || 0
    }));
  };

  const handleSendComponent = (bomType: string) => {
    const componentName = bomType === 'sub_assembly' ? 'Sub Assembly' : 
                         bomType === 'accessory' ? 'Accessory' : 'Main Assembly';
    onComponentSent(componentName);
  };

  const renderBOMSection = (title: string, items: any[], bomType: string) => {
    const isComponentSent = sentComponents.includes(title);
    
    return (
      <Card key={bomType} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isComponentSent && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Sent
                </Badge>
              )}
              <Button 
                size="sm"
                onClick={() => handleSendComponent(bomType)}
                disabled={isComponentSent}
              >
                {isComponentSent ? "Already Sent" : `Send ${title}`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component Name</TableHead>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Qty Required per Unit</TableHead>
                  <TableHead>Total Required Qty</TableHead>
                  <TableHead>Qty Issued to Production</TableHead>
                  <TableHead>Qty Short</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const totalRequired = item.quantity * productionOrder.quantity;
                  const issued = issuedQuantities[item.raw_materials.material_code] || 0;
                  const shortage = Math.max(0, totalRequired - issued);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.raw_materials.name}</TableCell>
                      <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{totalRequired}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={issuedQuantities[item.raw_materials.material_code] || ''}
                          onChange={(e) => handleQuantityChange(item.raw_materials.material_code, e.target.value)}
                          placeholder="0"
                          disabled={isComponentSent}
                        />
                      </TableCell>
                      <TableCell>
                        {shortage > 0 ? (
                          <span className="text-red-600 font-medium">{shortage}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {shortage > 0 ? (
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
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No {title.toLowerCase()} components found
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!productionOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            BOM & Kit Status - {productionOrder.voucher_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Product:</p>
              <p className="text-lg">{productionOrder.production_schedules?.projections?.products?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Production Quantity:</p>
              <p className="text-lg font-bold">{productionOrder.quantity}</p>
            </div>
          </div>

          {renderBOMSection("Sub Assembly", groupedBOM.sub_assembly, "sub_assembly")}
          {renderBOMSection("Accessories", groupedBOM.accessory, "accessory")}
          {renderBOMSection("Main Assembly", groupedBOM.main_assembly, "main_assembly")}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BOMKitStatusView;
