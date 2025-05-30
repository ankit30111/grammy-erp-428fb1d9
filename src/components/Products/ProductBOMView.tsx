
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ProductBOMViewProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductBOMView({ product, open, onOpenChange }: ProductBOMViewProps) {
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product && open) {
      fetchBOMItems();
    }
  }, [product, open]);

  const fetchBOMItems = async () => {
    if (!product) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bom')
        .select(`
          *,
          raw_materials (
            material_code,
            name,
            category
          )
        `)
        .eq('product_id', product.id)
        .order('bom_type');

      if (error) throw error;
      setBomItems(data || []);
    } catch (error) {
      console.error('Error fetching BOM items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBOMTypeColor = (type: string) => {
    switch (type) {
      case "main_assembly": return "bg-blue-100 text-blue-800";
      case "sub_assembly": return "bg-green-100 text-green-800";
      case "accessory": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getBOMItemsByType = (type: string) => {
    return bomItems.filter(item => item.bom_type === type);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>BOM for {product.name} ({product.product_code})</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center p-8">Loading BOM...</div>
        ) : (
          <div className="space-y-6">
            {["main_assembly", "sub_assembly", "accessory"].map((type) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="capitalize">{type.replace('_', ' ')}</span>
                    <Badge className={getBOMTypeColor(type)}>
                      {getBOMItemsByType(type).length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getBOMItemsByType(type).length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No items in this category
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {getBOMItemsByType(type).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.raw_materials?.material_code}</span>
                              {item.is_critical && (
                                <Badge variant="destructive" className="text-xs">Critical</Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {item.raw_materials?.name} - {item.raw_materials?.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">Qty: {item.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
