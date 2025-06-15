
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hash, Package, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useProductionVouchersWithDispatch } from "@/hooks/useProductionSerialNumbers";
import SerialNumberAssignment from "@/components/PPC/SerialNumberAssignment";

const SerialNumberManagement = () => {
  const { data: vouchers = [], isLoading, refetch } = useProductionVouchersWithDispatch();

  const assignedCount = vouchers.filter(v => v.serial_number_assignment).length;
  const pendingCount = vouchers.filter(v => !v.serial_number_assignment).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/ppc">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to PPC
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Serial Number Management</h1>
              <p className="text-muted-foreground">
                Assign serial number ranges to production vouchers with material dispatches
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{vouchers.length}</div>
                  <div className="text-sm text-muted-foreground">Total Vouchers with Dispatches</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Hash className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{assignedCount}</div>
                  <div className="text-sm text-muted-foreground">Serial Numbers Assigned</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Hash className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">{pendingCount}</div>
                  <div className="text-sm text-muted-foreground">Pending Assignment</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-2 animate-spin" />
              <p className="text-muted-foreground">Loading production vouchers...</p>
            </div>
          </div>
        ) : vouchers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Production Vouchers Found</h3>
              <p className="text-muted-foreground mb-4">
                No production vouchers with material dispatches are available for serial number assignment.
              </p>
              <p className="text-sm text-muted-foreground">
                Vouchers will appear here automatically once materials are dispatched from the Store to Production.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Filter Badges */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant="outline">
                All ({vouchers.length})
              </Badge>
              <Badge variant="default">
                Assigned ({assignedCount})
              </Badge>
              <Badge variant="secondary">
                Pending ({pendingCount})
              </Badge>
            </div>

            {/* Voucher List */}
            <div className="space-y-4">
              {vouchers.map((voucher) => (
                <SerialNumberAssignment key={voucher.id} voucher={voucher} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SerialNumberManagement;
