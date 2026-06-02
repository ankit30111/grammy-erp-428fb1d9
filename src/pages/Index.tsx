import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/Layout/PageHeader";
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
      <PageHeader
        title="Factory Dashboard"
        description="Real-time view across production, inventory, quality, and fulfillment"
        actions={
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "LIVE" : "OFFLINE"}
            </Badge>
            <Clock className="h-4 w-4 text-muted-foreground ml-2" />
          </div>
        }
      />
      <div className="grid gap-6">
        {[
          { title: "Order & Fulfillment", node: <OrderFulfillmentWidget /> },
          { title: "Production Overview", node: <ProductionOverviewWidget /> },
          { title: "Production Status", node: <ProductionStatusWidget /> },
          { title: "Inventory & Materials", node: <InventoryWidget /> },
          { title: "Quality Metrics", node: <QualityMetricsWidget /> },
          { title: "Vendor Performance", node: <VendorPerformanceWidget /> },
        ].map((section) => (
          <section key={section.title} className="page-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {section.title}
            </h2>
            {section.node}
          </section>
        ))}
      </div>
    </DashboardLayout>;
};
export default Index;