
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduledProduction as ScheduledProductionType, KitStatus, mockScheduledProductions, mockGRNs, mockMaterialRequests, GRNItem, MaterialRequest } from "@/types/store";
import EnhancedScheduledProduction from "@/components/Store/EnhancedScheduledProduction";
import EnhancedGRNReceiving from "@/components/Store/EnhancedGRNReceiving";
import ProductionFeedback from "@/components/Store/ProductionFeedback";
import InventoryManagement from "@/components/Store/InventoryManagement";
import SpareOrdersPacking from "@/components/Store/SpareOrdersPacking";
import { useToast } from "@/hooks/use-toast";
import { Layers } from "lucide-react";

export default function StoreDashboard() {
  const { toast } = useToast();
  const [productions, setProductions] = useState<ScheduledProductionType[]>(mockScheduledProductions);
  const [grns, setGRNs] = useState<GRNItem[]>(mockGRNs);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(mockMaterialRequests);

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
    
    // This would typically send a notification to the Purchase module
    // For now, we'll just log it
  };

  // Handlers for material requests
  const handleApproveMaterialRequest = (id: string) => {
    setMaterialRequests(prev =>
      prev.map(request =>
        request.id === id ? { ...request, status: "APPROVED" } : request
      )
    );
    
    toast({
      title: "Material Request Approved",
      description: "The additional material request has been approved",
    });
  };
  
  const handleRejectMaterialRequest = (id: string) => {
    setMaterialRequests(prev =>
      prev.map(request =>
        request.id === id ? { ...request, status: "REJECTED" } : request
      )
    );
    
    toast({
      title: "Material Request Rejected",
      description: "The additional material request has been rejected",
      variant: "destructive"
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center space-x-4 mb-6">
        <Layers className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Store Management - Grammy Electronics</h1>
      </div>

      <Tabs defaultValue="voucher-management" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="voucher-management">Voucher Management</TabsTrigger>
          <TabsTrigger value="material-receiving">Material Receiving</TabsTrigger>
          <TabsTrigger value="spare-orders">Spare Orders</TabsTrigger>
          <TabsTrigger value="production-feedback">Production Feedback</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="voucher-management" className="space-y-4">
          <EnhancedScheduledProduction 
            productions={productions}
            onStatusChange={handleKitStatusChange}
            onKitReceivedChange={handleKitReceivedChange}
            onShortageReportChange={handleShortageReportChange}
          />
        </TabsContent>

        <TabsContent value="material-receiving" className="space-y-4">
          <EnhancedGRNReceiving 
            grns={grns}
            onReceiveGRN={handleReceiveGRN}
            onDiscrepancyReport={handleDiscrepancyReport}
          />
        </TabsContent>

        <TabsContent value="spare-orders" className="space-y-4">
          <SpareOrdersPacking />
        </TabsContent>

        <TabsContent value="production-feedback" className="space-y-4">
          <ProductionFeedback 
            materialRequests={materialRequests}
            productions={productions}
            onApproveMaterialRequest={handleApproveMaterialRequest}
            onRejectMaterialRequest={handleRejectMaterialRequest}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <InventoryManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
