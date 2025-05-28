
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  ArrowRight,
  BarChart3,
  DollarSign
} from "lucide-react";
import { Link } from "react-router-dom";

const PPC = () => {
  // Mock data for the dashboard
  const planningMetrics = {
    scheduledProductions: 12,
    pendingMaterials: 3,
    completionRate: 85,
    upcomingDeadlines: 5
  };

  const purchaseMetrics = {
    pendingOrders: 8,
    totalValue: 245000,
    approvedOrders: 15,
    overduePOs: 2
  };

  const grnMetrics = {
    pendingReceiving: 6,
    receivedToday: 4,
    qualityIssues: 1,
    processedValue: 125000
  };

  const recentActivities = [
    { type: "planning", message: "Production scheduled for Speaker A300", time: "2 hours ago" },
    { type: "purchase", message: "PO-2025-045 approved for PCB components", time: "4 hours ago" },
    { type: "grn", message: "GRN-789 received with quality issues", time: "6 hours ago" },
    { type: "planning", message: "Material shortage identified for Tweeter T100", time: "1 day ago" }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">PPC Dashboard</h1>
            <p className="text-muted-foreground">Production Planning & Control Overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Last updated: Today, 14:35</span>
          </div>
        </div>

        {/* Department Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
                Planning Department
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{planningMetrics.scheduledProductions}</div>
                  <div className="text-muted-foreground">Scheduled Productions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{planningMetrics.pendingMaterials}</div>
                  <div className="text-muted-foreground">Pending Materials</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{planningMetrics.completionRate}% Completion Rate</span>
                </div>
                <Link to="/planning">
                  <Button variant="outline" size="sm" className="gap-2">
                    View Details <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                Purchase Department
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-bold text-green-600">{purchaseMetrics.pendingOrders}</div>
                  <div className="text-muted-foreground">Pending Orders</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">₹{(purchaseMetrics.totalValue / 1000).toFixed(0)}K</div>
                  <div className="text-muted-foreground">Total Value</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{purchaseMetrics.approvedOrders} Approved Today</span>
                </div>
                <Link to="/purchase">
                  <Button variant="outline" size="sm" className="gap-2">
                    View Details <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-orange-600" />
                GRN Department
                <Badge variant="destructive" className="ml-2">3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-bold text-orange-600">{grnMetrics.pendingReceiving}</div>
                  <div className="text-muted-foreground">Pending Receiving</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{grnMetrics.receivedToday}</div>
                  <div className="text-muted-foreground">Received Today</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">{grnMetrics.qualityIssues} Quality Issue</span>
                </div>
                <Link to="/grn">
                  <Button variant="outline" size="sm" className="gap-2">
                    View Details <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{planningMetrics.scheduledProductions + purchaseMetrics.pendingOrders}</div>
                  <div className="text-sm text-muted-foreground">Total Active Orders</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">₹{((purchaseMetrics.totalValue + grnMetrics.processedValue) / 1000).toFixed(0)}K</div>
                  <div className="text-sm text-muted-foreground">Total Value in Process</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">{planningMetrics.pendingMaterials + purchaseMetrics.overduePOs}</div>
                  <div className="text-sm text-muted-foreground">Critical Issues</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{Math.round((planningMetrics.completionRate + 88 + 92) / 3)}%</div>
                  <div className="text-sm text-muted-foreground">Overall Efficiency</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {activity.type === 'planning' && <Calendar className="h-5 w-5 text-blue-600" />}
                    {activity.type === 'purchase' && <ShoppingCart className="h-5 w-5 text-green-600" />}
                    {activity.type === 'grn' && <Package className="h-5 w-5 text-orange-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{activity.message}</div>
                    <div className="text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {activity.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
