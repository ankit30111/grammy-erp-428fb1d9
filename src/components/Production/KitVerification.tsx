
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";

const KitVerification = () => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [discrepancyComments, setDiscrepancyComments] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: kitItems = [] } = useQuery({
    queryKey: ["kit-verification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          *,
          kit_preparation!inner(
            kit_number,
            status,
            production_orders!inner(
              voucher_number,
              quantity as production_quantity,
              production_schedules!inner(
                projections!inner(
                  products!inner(name)
                )
              )
            )
          ),
          raw_materials!inner(
            material_code,
            name
          )
        `)
        .eq("kit_preparation.status", "SENT")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const handleCommentChange = (itemId: string, comment: string) => {
    setDiscrepancyComments(prev => ({
      ...prev,
      [itemId]: comment
    }));
  };

  const handleVerifyKit = async (kitId: string, items: any[]) => {
    try {
      const hasDiscrepancies = items.some(item => {
        const receivedQty = receivedQuantities[item.id] || 0;
        return receivedQty < item.actual_quantity;
      });

      if (hasDiscrepancies) {
        const itemsWithDiscrepancies = items.filter(item => {
          const receivedQty = receivedQuantities[item.id] || 0;
          return receivedQty < item.actual_quantity;
        });

        // Check if all discrepancy items have comments
        const missingComments = itemsWithDiscrepancies.filter(item => 
          !discrepancyComments[item.id]?.trim()
        );

        if (missingComments.length > 0) {
          toast({
            title: "Missing Discrepancy Comments",
            description: "Please provide comments for all items with discrepancies",
            variant: "destructive",
          });
          return;
        }

        // Log discrepancies to console for now (until production_feedback table is available)
        itemsWithDiscrepancies.forEach(item => {
          const receivedQty = receivedQuantities[item.id] || 0;
          const discrepancyQty = item.actual_quantity - receivedQty;
          
          console.log("Production Feedback Logged:", {
            voucher_number: item.kit_preparation.production_orders.voucher_number,
            component_code: item.raw_materials.material_code,
            sent_quantity: item.actual_quantity,
            received_quantity: receivedQty,
            discrepancy_quantity: discrepancyQty,
            section: "Kit Verification",
            remarks: discrepancyComments[item.id]
          });
        });
      }

      // Update kit items with verified quantities
      for (const item of items) {
        const receivedQty = receivedQuantities[item.id] || item.actual_quantity;
        
        await supabase
          .from("kit_items")
          .update({
            verified_by_production: true,
            actual_quantity: receivedQty
          })
          .eq("id", item.id);
      }

      // Update kit preparation status
      await supabase
        .from("kit_preparation")
        .update({ 
          status: hasDiscrepancies ? "VERIFIED_WITH_DISCREPANCY" : "VERIFIED"
        })
        .eq("id", kitId);

      toast({
        title: "Kit Verified",
        description: hasDiscrepancies 
          ? "Kit verified with discrepancies. Production feedback has been logged."
          : "Kit verified successfully",
      });

      // Clear local state for this kit
      items.forEach(item => {
        setReceivedQuantities(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
        setDiscrepancyComments(prev => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      });

    } catch (error) {
      console.error("Error verifying kit:", error);
      toast({
        title: "Error",
        description: "Failed to verify kit",
        variant: "destructive",
      });
    }
  };

  // Group kit items by kit preparation
  const groupedKits = kitItems.reduce((acc, item) => {
    const kitId = item.kit_preparation_id;
    if (!acc[kitId]) {
      acc[kitId] = {
        kit: item.kit_preparation,
        items: []
      };
    }
    acc[kitId].items.push(item);
    return acc;
  }, {} as Record<string, { kit: any; items: any[] }>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kit Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Object.entries(groupedKits).map(([kitId, { kit, items }]) => (
              <div key={kitId} className="border rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Kit: {kit.kit_number}</h3>
                  <p className="text-sm text-muted-foreground">
                    Voucher: {kit.production_orders.voucher_number} | 
                    Product: {kit.production_orders.production_schedules.projections.products.name}
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Qty Sent</TableHead>
                      <TableHead>Qty Received/Verified</TableHead>
                      <TableHead>Discrepancy Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const receivedQty = receivedQuantities[item.id] ?? item.actual_quantity;
                      const discrepancyQty = Math.max(0, item.actual_quantity - receivedQty);
                      const hasDiscrepancy = discrepancyQty > 0;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.raw_materials.name}</TableCell>
                          <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                          <TableCell>{item.actual_quantity}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={receivedQuantities[item.id] ?? item.actual_quantity}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              max={item.actual_quantity}
                              disabled={item.verified_by_production}
                            />
                          </TableCell>
                          <TableCell>
                            {discrepancyQty > 0 ? (
                              <span className="text-red-600 font-medium">{discrepancyQty}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.verified_by_production ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Verified
                              </Badge>
                            ) : hasDiscrepancy ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Discrepancy
                              </Badge>
                            ) : (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasDiscrepancy && !item.verified_by_production && (
                              <Textarea
                                placeholder="Required: Explain the discrepancy"
                                value={discrepancyComments[item.id] || ""}
                                onChange={(e) => handleCommentChange(item.id, e.target.value)}
                                className="min-h-[60px]"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={() => handleVerifyKit(kitId, items)}
                    disabled={items.every(item => item.verified_by_production)}
                  >
                    {items.every(item => item.verified_by_production) ? "Already Verified" : "Verify Kit"}
                  </Button>
                </div>
              </div>
            ))}

            {Object.keys(groupedKits).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No kits available for verification
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KitVerification;
