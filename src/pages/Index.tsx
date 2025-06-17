import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Clock, Wifi, WifiOff } from "lucide-react";
import { ProductionOverviewWidget } from "@/components/Dashboard/ProductionOverviewWidget";
import { OrderFulfillmentWidget } from "@/components/Dashboard/OrderFulfillmentWidget";
import { InventoryWidget } from "@/components/Dashboard/InventoryWidget";
import { QualityMetricsWidget } from "@/components/Dashboard/QualityMetricsWidget";
import { VendorPerformanceWidget } from "@/components/Dashboard/VendorPerformanceWidget";
import { ProductionStatusWidget } from "@/components/Dashboard/ProductionStatusWidget";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
const Index = () => {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  useEffect(() => {
    // Update timestamp every 30 seconds to show real-time status
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);

    // Monitor online/offline status
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return <DashboardLayout>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Factory Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "LIVE" : "OFFLINE"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              
              
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
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
    </DashboardLayout>;
};
export default Index;