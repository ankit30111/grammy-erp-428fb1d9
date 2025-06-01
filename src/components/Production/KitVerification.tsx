
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, CheckCircle, AlertTriangle, Factory } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const KitVerification = () => {
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<Record<string, number>>({});
  const [selectedLine, setSelectedLine] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kits = [], refetch } = useQuery({
    queryKey: ["kit-verification"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            quantity,
            production_schedules!inner(
              projections!inner(
                products!inner(name),
                customers!inner(name)
              )
            )
          ),
          kit_items(
            *,
            raw_materials!inner(name, material_code)
          )
        `)
        .in("status", ["PREPARING", "ACCESSORY COMPONENTS SENT", "SUB ASSEMBLY COMPONENTS SENT", "MAIN ASSEMBLY COMPONENTS SENT", "PARTIAL KIT SENT", "COMPLETE KIT SENT"])
        .order("created_at", { ascending: false });
      
      return data || [];
    },
    refetchInterval: 5000, // Refetch every 5 seconds to get real-time updates
  });

  const updateKitMutation = useMutation({
    mutationFn: async ({ kitId, updates }: { kitId: string; updates: any }) => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .update(updates)
        .eq("id", kitId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kit-verification"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      refetch();
    },
  });

  const reportDiscrepancyMutation = useMutation({
    mutationFn: async ({ productionOrderId, rawMaterialId, requiredQty, actualQty }: {
      productionOrderId: string;
      rawMaterialId: string;
      requiredQty: number;
      actualQty: number;
    }) => {
      const { data, error } = await supabase
        .from("material_requests")
        .insert({
          production_order_id: productionOrderId,
          raw_material_id: rawMaterialId,
          requested_quantity: requiredQty - actualQty,
          reason: "Material shortage reported from production",
          status: "PENDING",
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Discrepancy Reported",
        description: "Material shortage reported to Store team for approval",
      });
    },
  });

  const productionLines = [
    "Line-1",
    "Line-2", 
    "Sub Assembly-1",
    "Sub Assembly-2"
  ];

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'default';
      case 'DISCREPANCY': return 'destructive';
      case 'PREPARING': 
      case 'ACCESSORY COMPONENTS SENT':
      case 'SUB ASSEMBLY COMPONENTS SENT':
      case 'MAIN ASSEMBLY COMPONENTS SENT':
      case 'PARTIAL KIT SENT':
      case 'COMPLETE KIT SENT': return 'warning';
      default: return 'secondary';
    }
  };

  const getComponentsDescription = (status: string) => {
    switch (status) {
      case 'ACCESSORY COMPONENTS SENT': return 'Accessory Components';
      case 'SUB ASSEMBLY COMPONENTS SENT': return 'Sub Assembly Components';
      case 'MAIN ASSEMBLY COMPONENTS SENT': return 'Main Assembly Components';
      case 'PARTIAL KIT SENT': return 'Partial Kit';
      case 'COMPLETE KIT SENT': return 'Complete Kit';
      default: return 'Kit Components';
    }
  };

  const handleVerificationChange = (partCode: string, value: string) => {
    setVerificationData(prev => ({
      ...prev,
      [partCode]: parseInt(value) || 0
    }));
  };

  const handleReportDiscrepancy = async (kitId: string) => {
    const selectedKitDetails = kits.find(kit => kit.id === kitId);
    if (!selectedKitDetails) return;

    // Report discrepancies for items with shortages
    const shortageItems = selectedKitDetails.kit_items?.filter((item: any) => {
      const receivedQty = verificationData[item.raw_materials?.material_code] ?? item.actual_quantity ?? 0;
      return receivedQty < item.required_quantity;
    });

    if (shortageItems && shortageItems.length > 0) {
      for (const item of shortageItems) {
        const receivedQty = verificationData[item.raw_materials?.material_code] ?? item.actual_quantity ?? 0;
        await reportDiscrepancyMutation.mutateAsync({
          productionOrderId: selectedKitDetails.production_order_id,
          rawMaterialId: item.raw_material_id,
          requiredQty: item.required_quantity,
          actualQty: receivedQty,
        });
      }
    }
  };

  const handleCompleteVerification = async () => {
    if (!selectedLine) {
      toast({
        title: "Select Production Line",
        description: "Please select a production line before completing verification",
        variant: "destructive",
      });
      return;
    }

    if (!selectedKit) return;

    // Update kit status to verified and assign to production line
    await updateKitMutation.mutateAsync({
      kitId: selectedKit,
      updates: {
        status: "VERIFIED",
        sent_to_production_at: new Date().toISOString(),
      }
    });

    toast({
      title: "Kit Verified",
      description: `Kit verified and assigned to ${selectedLine}`,
    });
    
    setSelectedKit(null);
    setSelectedLine("");
    setVerificationData({});
  };

  if (kits.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Kit Verification (0 kits available)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No kits available for verification
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedKitDetails = kits.find(kit => kit.id === selectedKit);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kit Verification ({kits.length} kits available)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Kit Number</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Components Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kits.map((kit) => (
                <TableRow key={kit.id} className={selectedKit === kit.id ? "bg-accent" : ""}>
                  <TableCell>
                    <input 
                      type="radio" 
                      name="kit" 
                      checked={selectedKit === kit.id}
                      onChange={() => setSelectedKit(kit.id)} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">{kit.kit_number}</TableCell>
                  <TableCell>{kit.production_orders?.voucher_number}</TableCell>
                  <TableCell>{kit.production_orders?.production_schedules?.projections?.products?.name}</TableCell>
                  <TableCell>{kit.production_orders?.production_schedules?.projections?.customers?.name}</TableCell>
                  <TableCell>{getComponentsDescription(kit.status)}</TableCell>
                  <TableCell>
                    <Badge variant={getVerificationStatusColor(kit.status) as any}>
                      {kit.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => setSelectedKit(kit.id)}>
                      Verify Kit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedKit && selectedKitDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Kit Verification - {selectedKitDetails.kit_number} ({getComponentsDescription(selectedKitDetails.status)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedKitDetails.kit_items?.map((item: any) => {
                  const receivedQty = verificationData[item.raw_materials?.material_code] ?? item.actual_quantity ?? 0;
                  const isShort = receivedQty < item.required_quantity;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.raw_materials?.material_code}</TableCell>
                      <TableCell>{item.raw_materials?.name}</TableCell>
                      <TableCell>{item.required_quantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={verificationData[item.raw_materials?.material_code] || item.actual_quantity || ''}
                          onChange={(e) => handleVerificationChange(item.raw_materials?.material_code, e.target.value)}
                          placeholder="Enter qty"
                        />
                      </TableCell>
                      <TableCell>
                        {isShort ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Short
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          checked={item.verified_by_production} 
                          readOnly
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <Factory className="h-4 w-4" />
                <label className="text-sm font-medium">Select Production Line:</label>
                <Select value={selectedLine} onValueChange={setSelectedLine}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select line" />
                  </SelectTrigger>
                  <SelectContent>
                    {productionLines.map((line) => (
                      <SelectItem key={line} value={line}>
                        {line}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-4">
                <Button 
                  variant="outline"
                  onClick={() => handleReportDiscrepancy(selectedKit)}
                >
                  Report Discrepancy
                </Button>
                <Button onClick={handleCompleteVerification}>
                  Complete Verification
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KitVerification;
