
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package } from "lucide-react";
import EnhancedScheduledProduction from "@/components/Store/EnhancedScheduledProduction";
import EnhancedGRNReceiving from "@/components/Store/EnhancedGRNReceiving";
import InventoryManagement from "@/components/Store/InventoryManagement";
import SpareOrdersPacking from "@/components/Store/SpareOrdersPacking";

const StoreDashboard = () => {
  // Mock handlers for GRN Receiving component
  const handleReceiveGRN = (id: string, quantity: number) => {
    console.log(`Receiving GRN ${id} with quantity ${quantity}`);
  };

  const handleDiscrepancyReport = (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => {
    console.log(`Discrepancy reported for GRN ${grnId}: Expected ${expectedQty}, Received ${receivedQty}, PO: ${poNumber}`);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center space-x-4 mb-6">
          <Package className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Store Management</h1>
        </div>

        <Tabs defaultValue="voucher-management" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="voucher-management">Voucher Management</TabsTrigger>
            <TabsTrigger value="grn-receiving">GRN Receiving</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="spare-orders">Spare Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="voucher-management" className="space-y-4">
            <EnhancedScheduledProduction />
          </TabsContent>

          <TabsContent value="grn-receiving" className="space-y-4">
            <EnhancedGRNReceiving 
              grns={[]} 
              onReceiveGRN={handleReceiveGRN}
              onDiscrepancyReport={handleDiscrepancyReport}
            />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryManagement />
          </TabsContent>

          <TabsContent value="spare-orders" className="space-y-4">
            <SpareOrdersPacking />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default StoreDashboard;
