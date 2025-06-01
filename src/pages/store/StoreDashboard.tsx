
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

export default function StoreDashboard() {
  const { toast } = useToast();
  const { syncRawMaterialsToInventory, isLoading: isSyncing } = useInventorySync();
  const { data: productionOrders } = useProductionOrders();
  const [productions, setProductions] = useState<ScheduledProductionType[]>(mockScheduledProductions);
  const [grns, setGRNs] = useState<GRNItem[]>(mockGRNs);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(mockMaterialRequests);

  // Auto-sync inventory on component mount
  useEffect(() => {
    syncRawMaterialsToInventory.mutate();
  }, []);

  const handleSyncInventory = () => {
    syncRawMaterialsToInventory.mutate();
  };

  // Handler for updating kit status
  const handleKitStatusChange = (voucherId: string, status: string) => {
    // Update the kit status in the database
    toast({
      title: "Kit Status Updated",
      description: `Kit status has been updated to ${status}`,
    });
  };

  // Handler for sending components
  const handleSendComponent = (voucherId: string, component: string) => {
    toast({
      title: "Component Sent",
      description: `${component} has been sent to production for voucher ${voucherId}`,
    });
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
      case 'NOT_PREPARED': return 'secondary';
      case 'PREPARED': return 'warning';
      case 'SENT': return 'default';
      case 'VERIFIED': return 'default';
      case 'READY': return 'default';
      default: return 'secondary';
    }
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
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder={
                                <Badge variant={getKitStatusColor(order.kit_status) as any}>
                                  {order.kit_status === 'NOT_PREPARED' ? 'Not Ready' : 
                                   order.kit_status === 'PREPARED' ? 'Ready' : 
                                   order.kit_status === 'SENT' ? 'Sent to Production' : 
                                   order.kit_status?.replace('_', ' ')}
                                </Badge>
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NOT_PREPARED">Not Ready</SelectItem>
                              <SelectItem value="PREPARED">Ready</SelectItem>
                              <SelectItem value="SENT">Sent to Production</SelectItem>
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
                              <DropdownMenuItem onClick={() => handleSendComponent(order.voucher_number, "All Components")}>
                                Send All Components
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendComponent(order.voucher_number, "Main Assembly")}>
                                Send Main Assembly
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendComponent(order.voucher_number, "Sub Assembly")}>
                                Send Sub Assembly
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendComponent(order.voucher_number, "Accessory")}>
                                Send Accessory
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
