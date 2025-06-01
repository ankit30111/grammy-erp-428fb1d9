
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScheduledProduction as ScheduledProductionType, KitStatus, mockScheduledProductions, mockGRNs, mockMaterialRequests, GRNItem, MaterialRequest } from "@/types/store";
import EnhancedGRNReceiving from "@/components/Store/EnhancedGRNReceiving";
import ProductionFeedback from "@/components/Store/ProductionFeedback";
import InventoryManagement from "@/components/Store/InventoryManagement";
import SpareOrdersPacking from "@/components/Store/SpareOrdersPacking";
import { useToast } from "@/hooks/use-toast";
import { useInventorySync } from "@/hooks/useInventorySync";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { Layers, RefreshCw, Package, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function StoreDashboard() {
  const { toast } = useToast();
  const { syncRawMaterialsToInventory, isLoading: isSyncing } = useInventorySync();
  const { data: productionOrders } = useProductionOrders();
  const [productions, setProductions] = useState<ScheduledProductionType[]>(mockScheduledProductions);
  const [grns, setGRNs] = useState<GRNItem[]>(mockGRNs);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(mockMaterialRequests);
  const [kitStatuses, setKitStatuses] = useState<Record<string, string>>({});
  const [sentComponents, setSentComponents] = useState<Record<string, string[]>>({});

  // Auto-sync inventory on component mount
  useEffect(() => {
    syncRawMaterialsToInventory.mutate();
  }, []);

  // Load existing kit data on mount
  useEffect(() => {
    if (productionOrders) {
      loadExistingKitData();
    }
  }, [productionOrders]);

  const loadExistingKitData = async () => {
    try {
      const { data: existingKits, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          kit_items(
            *,
            raw_materials!inner(*)
          ),
          production_orders!inner(voucher_number)
        `);

      if (error) throw error;

      const newSentComponents: Record<string, string[]> = {};
      const newKitStatuses: Record<string, string> = {};

      existingKits?.forEach(kit => {
        const voucherNumber = kit.production_orders?.voucher_number;
        if (voucherNumber && kit.kit_items) {
          // Determine which component types have been sent based on BOM types in kit items
          const bomTypes = new Set<string>();
          kit.kit_items.forEach((item: any) => {
            // We'll need to get BOM type from the BOM table for this raw material
            // For now, we'll track based on status
          });

          // Parse status to determine sent components
          if (kit.status?.includes("ACCESSORY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Accessory"];
          }
          if (kit.status?.includes("SUB ASSEMBLY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Sub Assembly"];
          }
          if (kit.status?.includes("MAIN ASSEMBLY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Main Assembly"];
          }
          if (kit.status?.includes("COMPLETE KIT")) {
            newSentComponents[voucherNumber] = ["Main Assembly", "Sub Assembly", "Accessory"];
          }

          newKitStatuses[voucherNumber] = kit.status || "KIT NOT READY";
        }
      });

      setSentComponents(newSentComponents);
      setKitStatuses(newKitStatuses);
    } catch (error) {
      console.error("Error loading existing kit data:", error);
    }
  };

  const handleSyncInventory = () => {
    syncRawMaterialsToInventory.mutate();
  };

  // Handler for updating kit status
  const handleKitStatusChange = (voucherId: string, status: string) => {
    setKitStatuses(prev => ({
      ...prev,
      [voucherId]: status
    }));
    
    toast({
      title: "Kit Status Updated",
      description: `Kit status has been updated to ${status}`,
    });
  };

  // Handler for sending components
  const handleSendComponent = async (voucherId: string, component: string) => {
    try {
      // Check if component has already been sent
      const alreadySent = sentComponents[voucherId] || [];
      if (component !== "All Components" && alreadySent.includes(component)) {
        toast({
          title: "Component Already Sent",
          description: `${component} has already been sent for this voucher`,
          variant: "destructive",
        });
        return;
      }

      // Find the production order
      const productionOrder = productionOrders?.find(order => order.voucher_number === voucherId);
      if (!productionOrder) {
        toast({
          title: "Error",
          description: "Production order not found",
          variant: "destructive",
        });
        return;
      }

      // Check if kit preparation already exists
      const { data: existingKit, error: checkError } = await supabase
        .from("kit_preparation")
        .select("*")
        .eq("production_order_id", productionOrder.id)
        .maybeSingle();

      if (checkError) throw checkError;

      let kitPrepId = existingKit?.id;

      // Create kit preparation record only if it doesn't exist
      if (!existingKit) {
        const { data: kitPrep, error: kitError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: productionOrder.id,
            status: "PREPARING",
            kit_number: "", // This will be auto-generated by the trigger
          })
          .select()
          .single();

        if (kitError) throw kitError;
        kitPrepId = kitPrep.id;
      }

      // Get BOM items for this product with component type filtering
      const { data: bomItems, error: bomError } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(*)
        `)
        .eq("product_id", productionOrder.product_id);

      if (bomError) throw bomError;

      // Map component names to BOM types
      const componentToBomType: Record<string, string> = {
        "Main Assembly": "main_assembly",
        "Sub Assembly": "sub_assembly",
        "Accessory": "accessory"
      };

      // Filter BOM items based on component type
      let filteredBomItems = bomItems;
      if (component !== "All Components") {
        const bomType = componentToBomType[component];
        if (bomType) {
          filteredBomItems = bomItems?.filter(item => item.bom_type === bomType) || [];
        }
      }

      if (!filteredBomItems || filteredBomItems.length === 0) {
        toast({
          title: "No Components Found",
          description: `No ${component} components found for this product`,
          variant: "destructive",
        });
        return;
      }

      // Check which items already exist in kit_items to avoid duplicates
      const { data: existingKitItems, error: existingError } = await supabase
        .from("kit_items")
        .select("raw_material_id")
        .eq("kit_preparation_id", kitPrepId);

      if (existingError) throw existingError;

      const existingRawMaterialIds = new Set(existingKitItems?.map(item => item.raw_material_id) || []);

      // Filter out items that already exist
      const newBomItems = filteredBomItems.filter(item => !existingRawMaterialIds.has(item.raw_material_id));

      // Create kit items for new components only
      if (newBomItems.length > 0) {
        const kitItems = newBomItems.map(bomItem => ({
          kit_preparation_id: kitPrepId,
          raw_material_id: bomItem.raw_material_id,
          required_quantity: bomItem.quantity * productionOrder.quantity,
          actual_quantity: bomItem.quantity * productionOrder.quantity, // Assuming full quantity is sent
        }));

        const { error: itemsError } = await supabase
          .from("kit_items")
          .insert(kitItems);

        if (itemsError) throw itemsError;
      }

      // Update sent components tracking
      const newSentComponents = component === "All Components" 
        ? ["Main Assembly", "Sub Assembly", "Accessory"]
        : [...alreadySent, component];

      setSentComponents(prev => ({
        ...prev,
        [voucherId]: newSentComponents
      }));

      // Determine new status based on what has been sent
      let newStatus = "";
      if (component === "All Components") {
        newStatus = "COMPLETE KIT SENT";
      } else {
        // Check if all components have been sent
        const allComponents = ["Main Assembly", "Sub Assembly", "Accessory"];
        const allSent = allComponents.every(comp => newSentComponents.includes(comp));
        
        if (allSent) {
          newStatus = "COMPLETE KIT SENT";
        } else if (newSentComponents.includes("Main Assembly") && newSentComponents.includes("Sub Assembly") && newSentComponents.includes("Accessory")) {
          newStatus = "COMPLETE KIT SENT";
        } else if (newSentComponents.includes("Accessory") && newSentComponents.length === 1) {
          newStatus = "ACCESSORY COMPONENTS SENT";
        } else if (newSentComponents.includes("Sub Assembly") && newSentComponents.length === 1) {
          newStatus = "SUB ASSEMBLY COMPONENTS SENT";
        } else if (newSentComponents.includes("Main Assembly") && newSentComponents.length === 1) {
          newStatus = "MAIN ASSEMBLY COMPONENTS SENT";
        } else {
          // Multiple but not all components sent
          newStatus = "PARTIAL KIT SENT";
        }
      }

      // Update kit preparation status
      await supabase
        .from("kit_preparation")
        .update({ status: newStatus })
        .eq("id", kitPrepId);

      setKitStatuses(prev => ({
        ...prev,
        [voucherId]: newStatus
      }));

      toast({
        title: "Components Sent",
        description: `${component} has been sent to production for voucher ${voucherId}`,
      });

    } catch (error) {
      console.error("Error sending components:", error);
      toast({
        title: "Error",
        description: "Failed to send components to production",
        variant: "destructive",
      });
    }
  };

  // Check if component can be sent
  const canSendComponent = (voucherId: string, component: string) => {
    const alreadySent = sentComponents[voucherId] || [];
    if (component === "All Components") {
      return alreadySent.length === 0; // Can only send all if nothing has been sent
    }
    return !alreadySent.includes(component);
  };

  // Handler for receiving GRN
  const handleReceiveGRN = (id: string, quantity: number) => {
    const grn = grns.find(g => g.id === id);
    
    if (!grn) return;
    
    const hasDiscrepancy = quantity < grn.expectedQuantity;
    
    setGRNs(prev =>
      prev.map(g =>
        g.id === id
          ? {
              ...g,
              receivedQuantity: quantity,
              hasDiscrepancy,
              status: hasDiscrepancy ? "DISCREPANCY" : "RECEIVED"
            }
          : g
      )
    );
  };

  // Handler for GRN discrepancy reporting to purchase
  const handleDiscrepancyReport = (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => {
    console.log(`Discrepancy reported for GRN ${grnId}:`);
    console.log(`PO: ${poNumber}, Expected: ${expectedQty}, Received: ${receivedQty}`);
    console.log(`Purchase team notified. Vendor payment on hold.`);
    
    toast({
      title: "Discrepancy Reported",
      description: `Purchase team notified about quantity mismatch in PO ${poNumber}`,
    });
  };

  // Handler for material request approval
  const handleApproveMaterialRequest = (id: string) => {
    setMaterialRequests(prev =>
      prev.map(request =>
        request.id === id ? { ...request, status: "APPROVED" } : request
      )
    );
    
    toast({
      title: "Material Request Approved",
      description: "Material request has been approved",
    });
  };

  // Handler for material request rejection
  const handleRejectMaterialRequest = (id: string) => {
    setMaterialRequests(prev =>
      prev.map(request =>
        request.id === id ? { ...request, status: "REJECTED" } : request
      )
    );
    
    toast({
      title: "Material Request Rejected",
      description: "Material request has been rejected",
    });
  };

  const getKitStatusColor = (status: string) => {
    switch (status) {
      case 'KIT NOT READY': return 'secondary';
      case 'KIT READY': return 'default';
      case 'COMPLETE KIT SENT': return 'default';
      case 'ACCESSORY COMPONENTS SENT': return 'warning';
      case 'SUB ASSEMBLY COMPONENTS SENT': return 'warning';
      case 'MAIN ASSEMBLY COMPONENTS SENT': return 'warning';
      case 'PARTIAL KIT SENT': return 'warning';
      default: return 'secondary';
    }
  };

  const getKitStatusDisplay = (voucherId: string, originalStatus: string) => {
    const currentStatus = kitStatuses[voucherId];
    if (currentStatus) return currentStatus;
    
    return originalStatus === 'NOT_PREPARED' ? 'KIT NOT READY' : 'KIT READY';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Dashboard</h1>
          <p className="text-muted-foreground">Manage vouchers, kit preparation, inventory, GRN receiving, and material requests</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleSyncInventory}
            disabled={isSyncing}
            variant="outline"
            className="gap-2"
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Inventory
          </Button>
        </div>
      </div>

      <Tabs defaultValue="vouchers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vouchers">Voucher & Kit Management</TabsTrigger>
          <TabsTrigger value="grn">GRN Receiving</TabsTrigger>
          <TabsTrigger value="feedback">Production Feedback</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="spare-orders">Spare Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="vouchers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Production Voucher Management ({productionOrders?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productionOrders?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher No.</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Kit Status</TableHead>
                      <TableHead>Send Components</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.voucher_number}</TableCell>
                        <TableCell>{order.production_schedules?.projections?.products?.name}</TableCell>
                        <TableCell>{order.production_schedules?.projections?.customers?.name}</TableCell>
                        <TableCell>{format(new Date(order.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>
                          <Select onValueChange={(value) => handleKitStatusChange(order.voucher_number, value)}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder={
                                <Badge variant={getKitStatusColor(getKitStatusDisplay(order.voucher_number, order.kit_status)) as any}>
                                  {getKitStatusDisplay(order.voucher_number, order.kit_status)}
                                </Badge>
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="KIT NOT READY">Not Ready</SelectItem>
                              <SelectItem value="KIT READY">Ready</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                Send Components
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleSendComponent(order.voucher_number, "All Components")}
                                disabled={!canSendComponent(order.voucher_number, "All Components")}
                              >
                                Send All Components
                                {!canSendComponent(order.voucher_number, "All Components") && " (Already Sent)"}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleSendComponent(order.voucher_number, "Main Assembly")}
                                disabled={!canSendComponent(order.voucher_number, "Main Assembly")}
                              >
                                Send Main Assembly
                                {!canSendComponent(order.voucher_number, "Main Assembly") && " (Already Sent)"}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleSendComponent(order.voucher_number, "Sub Assembly")}
                                disabled={!canSendComponent(order.voucher_number, "Sub Assembly")}
                              >
                                Send Sub Assembly
                                {!canSendComponent(order.voucher_number, "Sub Assembly") && " (Already Sent)"}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleSendComponent(order.voucher_number, "Accessory")}
                                disabled={!canSendComponent(order.voucher_number, "Accessory")}
                              >
                                Send Accessory
                                {!canSendComponent(order.voucher_number, "Accessory") && " (Already Sent)"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getKitStatusColor(getKitStatusDisplay(order.voucher_number, order.kit_status)) as any}>
                            {getKitStatusDisplay(order.voucher_number, order.kit_status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No production vouchers found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grn">
          <EnhancedGRNReceiving 
            grns={grns}
            onReceiveGRN={handleReceiveGRN}
            onDiscrepancyReport={handleDiscrepancyReport}
          />
        </TabsContent>

        <TabsContent value="feedback">
          <ProductionFeedback 
            materialRequests={materialRequests}
            productions={productions}
            onApproveMaterialRequest={handleApproveMaterialRequest}
            onRejectMaterialRequest={handleRejectMaterialRequest}
          />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryManagement />
        </TabsContent>

        <TabsContent value="spare-orders">
          <SpareOrdersPacking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
