
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Store, Package, FileText, ArrowLeftRight, AlertTriangle, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Import existing components
import ProductionVoucherDetails from "@/components/Store/ProductionVoucherDetails";
import GRNManagement from "@/components/Purchase/GRNManagement";
import MaterialRequestsTab from "@/components/Store/MaterialRequestsTab";
import LogBook from "@/components/Store/LogBook";
import InventoryManagement from "@/components/Store/InventoryManagement";

// Import new components
import ProductionFeedbackTab from "@/components/Store/ProductionFeedbackTab";

const StoreDashboard = () => {
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Get pending feedback count for tab badge
  const { data: pendingFeedbackCount = 0 } = useQuery({
    queryKey: ["pending-feedback-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select("id", { count: 'exact' })
        .eq("status", "PENDING");
      
      if (error) return 0;
      return data?.length || 0;
    },
    refetchInterval: 10000, // Check every 10 seconds
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center space-x-4 mb-6">
        <Store className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Store Management - Grammy Electronics</h1>
      </div>

      <Tabs defaultValue="production-vouchers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="production-vouchers">Production Voucher Management</TabsTrigger>
          <TabsTrigger value="grn-management">GRN Management</TabsTrigger>
          <TabsTrigger value="material-requests">Material Requests</TabsTrigger>
          <TabsTrigger value="production-feedback" className="relative">
            Production Feedback
            {pendingFeedbackCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {pendingFeedbackCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logbook">LogBook</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="production-vouchers" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Production Voucher Management</h2>
            <Badge variant="outline">Real-time Inventory Deduction</Badge>
          </div>
          <ProductionVoucherDetails 
            voucherId={selectedVoucherId} 
            onBack={() => setSelectedVoucherId(null)} 
          />
        </TabsContent>

        <TabsContent value="grn-management" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5" />
            <h2 className="text-xl font-semibold">GRN Management</h2>
          </div>
          <GRNManagement />
        </TabsContent>

        <TabsContent value="material-requests" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <ArrowLeftRight className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Material Requests</h2>
          </div>
          <MaterialRequestsTab />
        </TabsContent>

        <TabsContent value="production-feedback" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Production Feedback & Discrepancies</h2>
            <Badge variant="outline">Store-Production Reconciliation</Badge>
          </div>
          <ProductionFeedbackTab />
        </TabsContent>

        <TabsContent value="logbook" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Material Movement LogBook</h2>
          </div>
          <LogBook />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Inventory Management</h2>
          </div>
          <InventoryManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StoreDashboard;
