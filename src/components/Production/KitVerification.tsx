
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KitVerification = () => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [discrepancyComments, setDiscrepancyComments] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kit items that have been sent by Store but not yet verified by Production
  const { data: kitsToVerify = [] } = useQuery({
    queryKey: ["kits-to-verify"],
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
              quantity,
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
        .in("kit_preparation.status", [
          "COMPLETE KIT SENT", 
          "PARTIAL KIT SENT", 
          "MAIN ASSEMBLY COMPONENTS SENT", 
          "SUB ASSEMBLY COMPONENTS SENT", 
          "ACCESSORY COMPONENTS SENT"
        ])
        .eq("verified_by_production", false)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch verified kit items
  const { data: verifiedKits = [] } = useQuery({
    queryKey: ["verified-kits"],
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
              quantity,
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
        .eq("verified_by_production", true)
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

  const verifyKitMutation = useMutation({
    mutationFn: async ({ kitId, items }: { kitId: string; items: any[] }) => {
      const hasDiscrepancies = items.some(item => {
        const receivedQty = receivedQuantities[item.id] || item.actual_quantity;
        return receivedQty < item.actual_quantity;
      });

      if (hasDiscrepancies) {
        const itemsWithDiscrepancies = items.filter(item => {
          const receivedQty = receivedQuantities[item.id] || item.actual_quantity;
          return receivedQty < item.actual_quantity;
        });

        // Check if all discrepancy items have comments
        const missingComments = itemsWithDiscrepancies.filter(item => 
          !discrepancyComments[item.id]?.trim()
        );

        if (missingComments.length > 0) {
          throw new Error("Please provide comments for all items with discrepancies");
        }
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

      return { hasDiscrepancies };
    },
    onSuccess: ({ hasDiscrepancies }) => {
      queryClient.invalidateQueries({ queryKey: ["kits-to-verify"] });
      queryClient.invalidateQueries({ queryKey: ["verified-kits"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
      
      toast({
        title: "Kit Verified",
        description: hasDiscrepancies 
          ? "Kit verified with discrepancies. Production feedback has been logged."
          : "Kit verified successfully",
      });

      // Clear local state
      setReceivedQuantities({});
      setDiscrepancyComments({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVerifyKit = (kitId: string, items: any[]) => {
    verifyKitMutation.mutate({ kitId, items });
  };

  // Group kit items by kit preparation
  const groupedKitsToVerify = kitsToVerify.reduce((acc, item) => {
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

  const groupedVerifiedKits = verifiedKits.reduce((acc, item) => {
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

  const renderKitTable = (groupedKits: any, showActions: boolean = true) => (
    <div className="space-y-8">
      {Object.entries(groupedKits).map(([kitId, { kit, items }]: [string, any]) => (
        <div key={kitId} className="border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Production Voucher: {kit.production_orders.voucher_number}</h3>
            <p className="text-sm text-muted-foreground">
              Product: {kit.production_orders.production_schedules.projections.products.name} | 
              Kit: {kit.kit_number}
            </p>
            <Badge variant={kit.status === "VERIFIED" ? "default" : kit.status === "VERIFIED_WITH_DISCREPANCY" ? "destructive" : "secondary"}>
              {kit.status.replace('_', ' ')}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Qty Sent</TableHead>
                <TableHead>Qty Received</TableHead>
                <TableHead>Discrepancy</TableHead>
                <TableHead>Status</TableHead>
                {showActions && <TableHead>Comments</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => {
                const receivedQty = receivedQuantities[item.id] ?? item.actual_quantity;
                const discrepancyQty = Math.max(0, item.actual_quantity - receivedQty);
                const hasDiscrepancy = discrepancyQty > 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.raw_materials.name}</TableCell>
                    <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                    <TableCell>{item.actual_quantity}</TableCell>
                    <TableCell>
                      {showActions ? (
                        <Input
                          type="number"
                          className="w-24"
                          value={receivedQuantities[item.id] ?? item.actual_quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          max={item.actual_quantity}
                        />
                      ) : (
                        <span>{receivedQty}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {discrepancyQty > 0 ? (
                        <span className="text-red-600 font-medium">{discrepancyQty}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasDiscrepancy ? (
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
                    {showActions && (
                      <TableCell>
                        {hasDiscrepancy && (
                          <Textarea
                            placeholder="Required: Explain the discrepancy"
                            value={discrepancyComments[item.id] || ""}
                            onChange={(e) => handleCommentChange(item.id, e.target.value)}
                            className="min-h-[60px]"
                          />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {showActions && (
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={() => handleVerifyKit(kitId, items)}
                disabled={verifyKitMutation.isPending}
              >
                {verifyKitMutation.isPending ? "Verifying..." : "Verify Kit"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

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
          <Tabs defaultValue="to-verify" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="to-verify">
                Kits to be Verified ({Object.keys(groupedKitsToVerify).length})
              </TabsTrigger>
              <TabsTrigger value="verified">
                Kits Verified ({Object.keys(groupedVerifiedKits).length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="to-verify" className="mt-6">
              {Object.keys(groupedKitsToVerify).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No kits available for verification
                </div>
              ) : (
                renderKitTable(groupedKitsToVerify, true)
              )}
            </TabsContent>
            
            <TabsContent value="verified" className="mt-6">
              {Object.keys(groupedVerifiedKits).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No verified kits found
                </div>
              ) : (
                renderKitTable(groupedVerifiedKits, false)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default KitVerification;
