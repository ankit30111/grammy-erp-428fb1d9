
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Clock } from "lucide-react";
import { ProductionOverviewWidget } from "@/components/Dashboard/ProductionOverviewWidget";
import { OrderFulfillmentWidget } from "@/components/Dashboard/OrderFulfillmentWidget";
import { InventoryWidget } from "@/components/Dashboard/InventoryWidget";
import { QualityMetricsWidget } from "@/components/Dashboard/QualityMetricsWidget";
import { VendorPerformanceWidget } from "@/components/Dashboard/VendorPerformanceWidget";
import { ProductionStatusWidget } from "@/components/Dashboard/ProductionStatusWidget";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="w-full h-full p-4">
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Factory Dashboard</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last updated:</span>
              <span className="text-sm font-medium">{new Date().toLocaleString()}</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Order & Fulfillment KPIs */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">📦 Order & Fulfillment</h2>
            <OrderFulfillmentWidget />
          </div>

          {/* Production Overview */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">🏭 Production Overview</h2>
            <ProductionOverviewWidget />
          </div>

          {/* Production Status */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">📌 Production Status</h2>
            <ProductionStatusWidget />
          </div>

          {/* Inventory & Material Movement */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">📈 Inventory & Materials</h2>
            <InventoryWidget />
          </div>

          {/* Quality Metrics */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">🔍 Quality Metrics</h2>
            <QualityMetricsWidget />
          </div>

          {/* Vendor Performance */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">🤝 Vendor Performance</h2>
            <VendorPerformanceWidget />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
