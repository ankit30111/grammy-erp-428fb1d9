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
  const [discrepancyComments, setDiscrepancyComments] = useState<Record<string, string>>({});
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
            product_id,
            production_schedules!inner(
              projections!inner(
                products!inner(id, name),
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
    refetchInterval: 5000,
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

  const logProductionFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: {
      voucherNumber: string;
      componentCode: string;
      sentQty: number;
      receivedQty: number;
      discrepancyQty: number;
      section: string;
      remarks?: string;
    }) => {
      // Insert into production_feedback table
      const { data, error } = await supabase
        .from("production_feedback")
        .insert({
          voucher_number: feedbackData.voucherNumber,
          component_code: feedbackData.componentCode,
          sent_quantity: feedbackData.sentQty,
          received_quantity: feedbackData.receivedQty,
          discrepancy_quantity: feedbackData.discrepancyQty,
          section: feedbackData.section,
          remarks: feedbackData.remarks,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Discrepancy Logged",
        description: "Production feedback has been recorded",
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

  const getBOMSection = (bomType: string) => {
    switch (bomType) {
      case 'sub_assembly': return 'Sub Assembly';
      case 'accessory': return 'Accessories';
      case 'main_assembly': return 'Main Assembly';
      default: return 'Unknown';
    }
  };

  const handleVerificationChange = (partCode: string, value: string) => {
    setVerificationData(prev => ({
      ...prev,
      [partCode]: parseInt(value) || 0
    }));
  };

  const handleDiscrepancyCommentChange = (partCode: string, comment: string) => {
    setDiscrepancyComments(prev => ({
      ...prev,
      [partCode]: comment
    }));
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

    const selectedKitDetails = kits.find(kit => kit.id === selectedKit);
    if (!selectedKitDetails) return;

    // Check for discrepancies and validate comments
    const discrepancies = selectedKitDetails.kit_items?.filter((item: any) => {
      const sentQty = item.actual_quantity ?? 0;
      const receivedQty = verificationData[item.raw_materials?.material_code] ?? sentQty;
      return receivedQty < sentQty;
    });

    // Check if all discrepancies have comments
    const missingComments = discrepancies?.filter((item: any) => {
      const hasDiscrepancy = (verificationData[item.raw_materials?.material_code] ?? item.actual_quantity) < item.actual_quantity;
      const hasComment = discrepancyComments[item.raw_materials?.material_code]?.trim();
      return hasDiscrepancy && !hasComment;
    });

    if (missingComments && missingComments.length > 0) {
      toast({
        title: "Missing Discrepancy Comments",
        description: "Please add comments for all components with discrepancies",
        variant: "destructive",
      });
      return;
    }

    // Log discrepancies to production feedback
    if (discrepancies && discrepancies.length > 0) {
      for (const item of discrepancies) {
        const sentQty = item.actual_quantity ?? 0;
        const receivedQty = verificationData[item.raw_materials?.material_code] ?? sentQty;
        const discrepancyQty = sentQty - receivedQty;
        
        // Get BOM info to determine section
        const { data: bomInfo } = await supabase
          .from("bom")
          .select("bom_type")
          .eq("raw_material_id", item.raw_material_id)
          .eq("product_id", selectedKitDetails.production_orders.product_id)
          .single();

        await logProductionFeedbackMutation.mutateAsync({
          voucherNumber: selectedKitDetails.production_orders.voucher_number,
          componentCode: item.raw_materials.material_code,
          sentQty: sentQty,
          receivedQty: receivedQty,
          discrepancyQty: discrepancyQty,
          section: getBOMSection(bomInfo?.bom_type || 'unknown'),
          remarks: discrepancyComments[item.raw_materials?.material_code] || ''
        });
      }
    }

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
    setDiscrepancyComments({});
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
                <TableHead>Components Received</TableHead>
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
                  <TableHead>Raw Material Name</TableHead>
                  <TableHead>BOM Section</TableHead>
                  <TableHead>Qty Sent by Store</TableHead>
                  <TableHead>Qty Received & Verified</TableHead>
                  <TableHead>Discrepancy Qty</TableHead>
                  <TableHead>Discrepancy Comment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedKitDetails.kit_items?.map((item: any) => {
                  const sentQty = item.actual_quantity || 0;
                  const receivedQty = verificationData[item.raw_materials?.material_code] ?? sentQty;
                  const discrepancyQty = sentQty - receivedQty;
                  const hasDiscrepancy = discrepancyQty > 0;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                      <TableCell className="font-medium">{item.raw_materials?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          Mixed Components
                        </Badge>
                      </TableCell>
                      <TableCell>{sentQty}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={verificationData[item.raw_materials?.material_code] ?? ''}
                          onChange={(e) => handleVerificationChange(item.raw_materials?.material_code, e.target.value)}
                          placeholder={sentQty.toString()}
                        />
                      </TableCell>
                      <TableCell>
                        {discrepancyQty !== 0 ? (
                          <span className={discrepancyQty > 0 ? "text-red-600 font-medium" : "text-blue-600 font-medium"}>
                            {discrepancyQty > 0 ? `+${discrepancyQty}` : discrepancyQty}
                          </span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasDiscrepancy ? (
                          <Input
                            type="text"
                            className="w-40"
                            placeholder="Required for discrepancy"
                            value={discrepancyComments[item.raw_materials?.material_code] || ''}
                            onChange={(e) => handleDiscrepancyCommentChange(item.raw_materials?.material_code, e.target.value)}
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {discrepancyQty !== 0 ? (
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
