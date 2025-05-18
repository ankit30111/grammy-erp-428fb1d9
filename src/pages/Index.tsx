
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { StatCard } from "@/components/Dashboard/StatCard";
import { ActivityFeed } from "@/components/Dashboard/ActivityFeed";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Package, Truck, AlertTriangle, Clock, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data - in a real app this would come from your backend/database
const activities = [
  {
    id: "1",
    action: "Quality check completed",
    subject: "Batch #A7842",
    department: "Quality",
    timestamp: "10 mins ago",
    status: "approved" as const
  },
  {
    id: "2",
    action: "Raw materials received",
    subject: "PO #24765",
    department: "Store",
    timestamp: "32 mins ago",
    status: "pending" as const
  },
  {
    id: "3",
    action: "Assembly completed",
    subject: "Product SKU-78910",
    department: "Production",
    timestamp: "1 hour ago",
    status: "inProgress" as const
  },
  {
    id: "4",
    action: "Final QC failed",
    subject: "Lot #L8823",
    department: "Quality",
    timestamp: "2 hours ago",
    status: "rejected" as const
  },
  {
    id: "5",
    action: "Shipment dispatched",
    subject: "Order #OR9982",
    department: "Dispatch",
    timestamp: "4 hours ago",
    status: "approved" as const
  }
];

// Production stats data
const productionData = [
  { name: "Week 1", planned: 450, actual: 420 },
  { name: "Week 2", planned: 500, actual: 480 },
  { name: "Week 3", planned: 500, actual: 520 },
  { name: "Week 4", planned: 550, actual: 540 }
];

// Department KPIs
const departmentKPIs = [
  { 
    name: "Production",
    kpis: [
      { name: "Efficiency", value: "92%", target: "95%" },
      { name: "On-Time", value: "89%", target: "90%" },
      { name: "Rework Rate", value: "3.2%", target: "<3%" }
    ] 
  },
  { 
    name: "Quality",
    kpis: [
      { name: "First Pass Yield", value: "94.5%", target: "95%" },
      { name: "Defect Rate", value: "1.2%", target: "<1%" },
      { name: "Audit Score", value: "96%", target: "98%" }
    ] 
  }
];

const productionAlerts = [
  { id: "1", message: "Material shortage detected for SKU-5678", severity: "high" },
  { id: "2", message: "Batch #A7842 pending final QC", severity: "medium" },
  { id: "3", message: "Line 2 efficiency below target", severity: "low" }
];

const Index = () => {
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Production Efficiency" 
            value="92.6%" 
            trend={{ value: 2.1, isPositive: true }}
            icon={<BarChart2 className="h-5 w-5" />}
          />
          <StatCard 
            title="Quality Pass Rate" 
            value="94.3%" 
            trend={{ value: 0.8, isPositive: false }}
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
          <StatCard 
            title="Inventory Accuracy" 
            value="98.7%" 
            trend={{ value: 1.3, isPositive: true }}
            icon={<Package className="h-5 w-5" />}
          />
          <StatCard 
            title="On-Time Delivery" 
            value="91.2%" 
            trend={{ value: 3.7, isPositive: true }}
            icon={<Truck className="h-5 w-5" />}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Production Alerts */}
          <Card className="col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-status-pending" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productionAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                  <div 
                    className={cn(
                      "w-2 h-2 mt-1.5 rounded-full",
                      alert.severity === "high" ? "bg-status-rejected" : 
                      alert.severity === "medium" ? "bg-status-pending" : "bg-status-approved"
                    )}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)} Priority
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Department KPIs Cards */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle>Department KPIs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {departmentKPIs.map((dept) => (
                <div key={dept.name} className="space-y-2">
                  <h3 className="font-medium text-sm">{dept.name}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {dept.kpis.map((kpi) => (
                      <div key={kpi.name} className="p-2 bg-background rounded-lg border">
                        <p className="text-xs text-muted-foreground">{kpi.name}</p>
                        <div className="flex items-end justify-between mt-1">
                          <span className="text-lg font-semibold">{kpi.value}</span>
                          <span className="text-xs text-muted-foreground">Target: {kpi.target}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <ActivityFeed activities={activities} className="lg:col-span-7" />
          
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Production Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p>Production chart will be displayed here</p>
                  <p className="text-sm">(Connect to real data source)</p>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Today's Production</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">128/150</span>
                    <StatusBadge status="inProgress" withDot={false}>In Progress</StatusBadge>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weekly Target</span>
                  <span className="font-medium">536/750 (71.5%)</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Forecast</span>
                  <span className="font-medium">On Track</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
