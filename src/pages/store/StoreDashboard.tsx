
import { useState, lazy, Suspense } from "react";
import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";

// Lazy load components for better performance
const ProductionVoucherDetails = lazy(() => import("@/components/Store/ProductionVoucherDetails"));
const ProductionVoucherList = lazy(() => import("@/components/Store/ProductionVoucherList"));
const GRNReceiving = lazy(() => import("@/components/Store/GRNReceiving"));
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
  const [activeTab, setActiveTab] = useState("production-vouchers");

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

  const tabs = [
    { id: "production-vouchers", label: "Production Vouchers" },
    { id: "grn-receiving", label: "GRN Receiving" },
    { id: "production-feedback", label: "Production Feedback", count: pendingFeedbackCount },
    { id: "material-requests", label: "Material Requests" },
    { id: "inventory", label: "Inventory" },
    { id: "stock-reconciliation", label: "Stock Reconciliation" },
    { id: "logbook", label: "LogBook" },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedVoucherId(null);
  };

  return (
    <div className="mx-auto w-full min-w-0 py-4">
      {!selectedVoucherId && (
        <PageHeader title="Store" subtitle="Receipts, issues and material movements" />
      )}

      {!selectedVoucherId && <TabBar tabs={tabs} value={activeTab} onChange={handleTabChange} />}

      <div className={selectedVoucherId ? "" : "pt-4"}>
        {activeTab === "production-vouchers" && (
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
        )}

        {activeTab === "grn-receiving" && (
          <Suspense fallback={<TabLoader />}>
            <GRNReceiving />
          </Suspense>
        )}

        {activeTab === "production-feedback" && (
          <Suspense fallback={<TabLoader />}>
            <ProductionFeedbackTab />
          </Suspense>
        )}

        {activeTab === "material-requests" && (
          <Suspense fallback={<TabLoader />}>
            <MaterialRequestsTab />
          </Suspense>
        )}

        {activeTab === "inventory" && (
          <Suspense fallback={<TabLoader />}>
            <InventoryManagement />
          </Suspense>
        )}

        {activeTab === "stock-reconciliation" && (
          <Suspense fallback={<TabLoader />}>
            <StockReconciliation />
          </Suspense>
        )}

        {activeTab === "logbook" && (
          <Suspense fallback={<TabLoader />}>
            <LogBook />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default StoreDashboard;
