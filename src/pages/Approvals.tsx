
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Clock, Package, FileText, Users, TrendingUp } from "lucide-react";
import PurchaseOrderApprovalsEnhanced from "@/components/Approvals/PurchaseOrderApprovalsEnhanced";
import CAPAApprovalsTab from "@/components/Approvals/CAPAApprovalsTab";
import CAPATrackingTab from "@/components/Approvals/CAPATrackingTab";

const Approvals = () => {
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Approvals & Workflow Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs defaultValue="purchase-orders" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Purchase Order Approvals
            </TabsTrigger>
            <TabsTrigger value="capa-approvals" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CAPA Approvals
            </TabsTrigger>
            <TabsTrigger value="capa-tracking" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              CAPA Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="space-y-4">
            <PurchaseOrderApprovalsEnhanced />
          </TabsContent>

          <TabsContent value="capa-approvals" className="space-y-4">
            <CAPAApprovalsTab />
          </TabsContent>

          <TabsContent value="capa-tracking" className="space-y-4">
            <CAPATrackingTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
