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
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useState, useEffect } from "react";
import { calculateMaterialShortages, MaterialShortage } from "@/utils/materialShortageCalculator";

const PPC = () => {
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: purchaseOrders } = usePurchaseOrders();

  // Calculate material shortages
  useEffect(() => {
    const calculateShortages = async () => {
      if (projections?.length) {
        try {
          const calculatedShortages = await calculateMaterialShortages(projections.map(p => p.id));
          setShortages(calculatedShortages);
        } catch (error) {
          console.error('Error calculating shortages:', error);
        }
      }
    };

    calculateShortages();
  }, [projections]);

  const totalOrderValue = purchaseOrders?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0;
  const pendingPOs = purchaseOrders?.filter(po => po.status === 'PENDING').length || 0;
  const unscheduledProjections = projections?.length ? 
    projections.length - (schedules?.length || 0) : 0;

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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Projections</span>
                  <span className="font-medium">{projections?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled</span>
                  <span className="font-medium">{schedules?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unscheduled</span>
                  <Badge variant={unscheduledProjections > 0 ? "destructive" : "secondary"}>
                    {unscheduledProjections}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    {unscheduledProjections === 0 ? "All scheduled" : "Needs planning"}
                  </span>
                </div>
                <Link to="/planning-dashboard">
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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Material Shortages</span>
                  <Badge variant={shortages.length > 0 ? "destructive" : "secondary"}>
                    {shortages.length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Purchase Orders</span>
                  <span className="font-medium">{purchaseOrders?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pending POs</span>
                  <Badge variant={pendingPOs > 0 ? "warning" : "secondary"}>
                    {pendingPOs}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm">₹{totalOrderValue.toFixed(0)} in POs</span>
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
                <p className="text-muted-foreground">No GRN data yet</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Ready to receive</span>
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
                  <div className="text-2xl font-bold">{projections?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Active Projections</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">₹{totalOrderValue.toFixed(0)}</div>
                  <div className="text-sm text-muted-foreground">Total PO Value</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">{shortages.length}</div>
                  <div className="text-sm text-muted-foreground">Material Shortages</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{schedules?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Scheduled Productions</div>
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
              Workflow Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className={`p-4 border rounded-lg ${projections?.length ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium mb-2">Step 1: Customer Projections</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {projections?.length ? 
                        `${projections.length} projections added` : 
                        'Add customer projections for products they want to order'
                      }
                    </p>
                  </div>
                  {projections?.length ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <Link to="/projection">
                      <Button variant="outline" size="sm">
                        Add Projections
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
              
              <div className={`p-4 border rounded-lg ${shortages.length ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}>
                <h3 className="font-medium mb-2">Step 2: Material Shortages</h3>
                <p className="text-sm text-muted-foreground">
                  {shortages.length ? 
                    `${shortages.length} materials need to be purchased` : 
                    projections?.length ? 
                      'All materials are available in stock' :
                      'Material shortages will be calculated when projections are added'
                  }
                </p>
              </div>
              
              <div className={`p-4 border rounded-lg ${purchaseOrders?.length ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                <h3 className="font-medium mb-2">Step 3: Purchase Orders</h3>
                <p className="text-sm text-muted-foreground">
                  {purchaseOrders?.length ? 
                    `${purchaseOrders.length} purchase orders created` : 
                    'Purchase orders will be created for shortage materials'
                  }
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
