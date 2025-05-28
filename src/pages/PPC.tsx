
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">No productions scheduled yet</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Ready to plan productions</span>
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">No purchase orders yet</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Ready to create POs</span>
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <p className="text-muted-foreground">No materials received yet</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Ready to receive materials</span>
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
                  <div className="text-2xl font-bold">0</div>
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
                  <div className="text-2xl font-bold">₹0</div>
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
                  <div className="text-2xl font-bold">0</div>
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
                  <div className="text-2xl font-bold">--</div>
                  <div className="text-sm text-muted-foreground">Overall Efficiency</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Step 1: Customer Projections</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Start by adding customer projections for products they want to order.
                </p>
                <Link to="/projection">
                  <Button variant="outline" size="sm">
                    Add Projections
                  </Button>
                </Link>
              </div>
              
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-medium mb-2">Step 2: Production Planning</h3>
                <p className="text-sm text-muted-foreground">
                  Once projections are added, plan productions and identify material shortages.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-medium mb-2">Step 3: Purchase & GRN</h3>
                <p className="text-sm text-muted-foreground">
                  Create purchase orders for shortage materials and manage goods receiving.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
