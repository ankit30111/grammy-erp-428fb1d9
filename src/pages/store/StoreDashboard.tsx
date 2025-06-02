import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduledProduction as ScheduledProductionType, mockScheduledProductions, mockGRNs, mockMaterialRequests, GRNItem, MaterialRequest } from "@/types/store";
import EnhancedGRNReceiving from "@/components/Store/EnhancedGRNReceiving";
import ProductionFeedback from "@/components/Store/ProductionFeedback";
import InventoryManagement from "@/components/Store/InventoryManagement";
import SpareOrdersPacking from "@/components/Store/SpareOrdersPacking";
import VoucherKitManagement from "@/components/Store/VoucherKitManagement";
import StoreDashboardHeader from "@/components/Store/StoreDashboardHeader";
import { useToast } from "@/hooks/use-toast";
import { useInventorySync } from "@/hooks/useInventorySync";
import { useKitManagement } from "@/hooks/useKitManagement";
import EnhancedProductionVoucherDetails from "@/components/Store/EnhancedProductionVoucherDetails";
import MaterialMovementLogBook from "@/components/Store/MaterialMovementLogBook";

export default function StoreDashboard() {
  const { toast } = useToast();
  const { syncRawMaterialsToInventory, isLoading: isSyncing } = useInventorySync();
  const {
    kitStatuses,
    setKitStatuses,
    sentComponents,
    setSentComponents,
    voucherStatuses
  } = useKitManagement();
  
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

  const handleDiscrepancyReport = (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => {
    console.log(`Discrepancy reported for GRN ${grnId}:`);
    console.log(`PO: ${poNumber}, Expected: ${expectedQty}, Received: ${receivedQty}`);
    console.log(`Purchase team notified. Vendor payment on hold.`);
    
    toast({
      title: "Discrepancy Reported",
      description: `Purchase team notified about quantity mismatch in PO ${poNumber}`,
    });
  };

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <StoreDashboardHeader 
        onSyncInventory={handleSyncInventory}
        isSyncing={isSyncing}
      />

      <Tabs defaultValue="production-vouchers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="production-vouchers">Production Voucher Management</TabsTrigger>
          <TabsTrigger value="grn">GRN Receiving</TabsTrigger>
          <TabsTrigger value="feedback">Production Feedback</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="spare-orders">Spare Orders</TabsTrigger>
          <TabsTrigger value="log-book">Log Book</TabsTrigger>
        </TabsList>

        <TabsContent value="production-vouchers">
          <VoucherKitManagement
            sentComponents={sentComponents}
            setSentComponents={setSentComponents}
            kitStatuses={kitStatuses}
            setKitStatuses={setKitStatuses}
            voucherStatuses={voucherStatuses}
          />
        </TabsContent>

        <TabsContent value="grn">
          <EnhancedGRNReceiving 
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

        <TabsContent value="log-book">
          <MaterialMovementLogBook />
        </TabsContent>
      </Tabs>
    </div>
  );
}
