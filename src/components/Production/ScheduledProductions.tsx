
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Factory, Package } from "lucide-react";
import { mockScheduledProductionsForProduction } from "@/types/production";
import { useState } from "react";

const ScheduledProductions = () => {
  const [selectedProduction, setSelectedProduction] = useState<string | null>(null);

  const getKitStatusColor = (status: string) => {
    switch (status) {
      case 'KIT READY': return 'default';
      case 'KIT SENT': return 'default';
      case 'KIT VERIFIED': return 'default';
      case 'KIT SCHEDULED': return 'warning';
      case 'KIT SHORTAGE': return 'destructive';
      case 'YET TO PLANNED': return 'secondary';
      default: return 'secondary';
    }
  };

  const getProductionStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'default';
      case 'COMPLETED': return 'default';
      case 'ON_HOLD': return 'destructive';
      case 'NOT_STARTED': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Productions ({mockScheduledProductionsForProduction.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Kit Status</TableHead>
                <TableHead>Production Status</TableHead>
                <TableHead>Assigned Line</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockScheduledProductionsForProduction.map((production) => (
                <TableRow key={production.id}>
                  <TableCell className="font-medium">{production.voucherNumber}</TableCell>
                  <TableCell>{production.modelName}</TableCell>
                  <TableCell>{new Date(production.scheduledDate).toLocaleDateString()}</TableCell>
                  <TableCell>{production.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={getKitStatusColor(production.kitStatus) as any}>
                      {production.kitStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getProductionStatusColor(production.productionStatus) as any}>
                      {production.productionStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{production.assignedLine || 'Not assigned'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {production.kitStatus === 'KIT SENT' && production.productionStatus === 'NOT_STARTED' && (
                        <Button size="sm" className="gap-2">
                          <Package className="h-4 w-4" />
                          Start Production
                        </Button>
                      )}
                      {production.productionStatus === 'IN_PROGRESS' && (
                        <Button size="sm" variant="outline" className="gap-2">
                          <Factory className="h-4 w-4" />
                          View Details
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduledProductions;
