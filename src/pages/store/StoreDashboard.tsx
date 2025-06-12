
import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Store, Package, FileText, ArrowLeftRight, AlertTriangle, BookOpen, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Lazy load components for better performance
const ProductionVoucherDetails = lazy(() => import("@/components/Store/ProductionVoucherDetails"));
const ProductionVoucherList = lazy(() => import("@/components/Store/ProductionVoucherList"));
const GRNManagement = lazy(() => import("@/components/Purchase/GRNManagement"));
const MaterialRequestsTab = lazy(() => import("@/components/Store/MaterialRequestsTab"));
const LogBook = lazy(() => import("@/components/Store/LogBook"));
const InventoryManagement = lazy(() => import("@/components/Store/InventoryManagement"));
const ProductionFeedbackTab = lazy(() => import("@/components/Store/ProductionFeedbackTab"));
const StockReconciliation = lazy(() => import("@/components/Store/StockReconciliation"));

// Loading component for tab content
const TabLoader = () => (
  <div className="flex items-center justify-center py-8">
    <div className="text-center">
      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const StoreDashboard = () => {
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Get pending feedback count for tab badge with optimized query
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
    refetchInterval: 30000, // Reduced frequency for better performance
    staleTime: 20000, // Cache for 20 seconds
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center space-x-4 mb-6">
        <Store className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Store Management - Grammy Electronics</h1>
      </div>

      <Tabs defaultValue="production-vouchers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="production-vouchers">Production Vouchers</TabsTrigger>
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
          <TabsTrigger value="stock-reconciliation">Stock Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="production-vouchers" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Production Voucher Management</h2>
            <Badge variant="outline">Real-time Inventory Deduction</Badge>
          </div>
          
          <Suspense fallback={<TabLoader />}>
            {selectedVoucherId ? (
              <ProductionVoucherDetails 
                voucherId={selectedVoucherId} 
                onBack={() => setSelectedVoucherId(null)} 
              />
            ) : (
              <ProductionVoucherList 
                onSelectVoucher={setSelectedVoucherId}
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="grn-management" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5" />
            <h2 className="text-xl font-semibold">GRN Management</h2>
          </div>
          <Suspense fallback={<TabLoader />}>
            <GRNManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="material-requests" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <ArrowLeftRight className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Material Requests</h2>
          </div>
          <Suspense fallback={<TabLoader />}>
            <MaterialRequestsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="production-feedback" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Production Feedback & Discrepancies</h2>
            <Badge variant="outline">Store-Production Reconciliation</Badge>
          </div>
          <Suspense fallback={<TabLoader />}>
            <ProductionFeedbackTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="logbook" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Material Movement LogBook</h2>
          </div>
          <Suspense fallback={<TabLoader />}>
            <LogBook />
          </Suspense>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Inventory Management</h2>
          </div>
          <Suspense fallback={<TabLoader />}>
            <InventoryManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="stock-reconciliation" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Scale className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Stock Reconciliation</h2>
            <Badge variant="outline">Inventory Adjustment</Badge>
          </div>
          <Suspense fallback={<TabLoader />}>
            <StockReconciliation />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StoreDashboard;
