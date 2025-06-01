import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScheduledProduction as ScheduledProductionType, KitStatus, mockScheduledProductions, mockGRNs, mockMaterialRequests, GRNItem, MaterialRequest } from "@/types/store";
import EnhancedScheduledProduction from "@/components/Store/EnhancedScheduledProduction";
import EnhancedGRNReceiving from "@/components/Store/EnhancedGRNReceiving";
import ProductionFeedback from "@/components/Store/ProductionFeedback";
import InventoryManagement from "@/components/Store/InventoryManagement";
import SpareOrdersPacking from "@/components/Store/SpareOrdersPacking";
import { useToast } from "@/hooks/use-toast";
import { useInventorySync } from "@/hooks/useInventorySync";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { Layers, RefreshCw, Package } from "lucide-react";
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
  const handleKitStatusChange = (id: string, status: KitStatus) => {
    setProductions(prev =>
      prev.map(production =>
        production.id === id ? { ...production, kitStatus: status } : production
      )
    );
    
    toast({
      title: "Kit Status Updated",
      description: `Kit status has been updated to ${status}`,
    });
  };

  // Handler for marking kit as received by production
  const handleKitReceivedChange = (id: string, received: boolean) => {
    setProductions(prev =>
      prev.map(production =>
        production.id === id ? { ...production, kitReceived: received } : production
      )
    );
    
    toast({
      title: received ? "Kit Marked as Received" : "Kit Receipt Cancelled",
      description: received 
        ? "Production has confirmed receipt of the kit" 
        : "Kit receipt status has been reset",
    });
  };

  // Handler for reporting shortage
  const handleShortageReportChange = (id: string, hasShortage: boolean) => {
    setProductions(prev =>
      prev.map(production =>
        production.id === id ? { ...production, shortageReported: hasShortage } : production
      )
    );
    
    if (hasShortage) {
      toast({
        title: "Shortage Reported",
        description: "Production has reported a shortage in the kit",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Shortage Report Cancelled",
        description: "Production shortage report has been cancelled",
      });
    }
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
          <div className="space-y-6">
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
                        <TableHead>Production Status</TableHead>
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
                            <Badge variant={getKitStatusColor(order.kit_status) as any}>
                              {order.kit_status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'PENDING' ? 'secondary' : 'default'}>
                              {order.status}
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

            <EnhancedScheduledProduction 
              productions={productions}
              onStatusChange={handleKitStatusChange}
              onKitReceivedChange={handleKitReceivedChange}
              onShortageReportChange={handleShortageReportChange}
            />
          </div>
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
