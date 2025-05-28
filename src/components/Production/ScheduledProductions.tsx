
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScheduledProductionForProduction, mockScheduledProductionsForProduction, mockProductionLines } from "@/types/production";
import { Calendar, Play, Pause, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ScheduledProductions() {
  const { toast } = useToast();
  const [productions, setProductions] = useState<ScheduledProductionForProduction[]>(mockScheduledProductionsForProduction);

  const handleAssignLine = (productionId: string, lineId: string) => {
    const line = mockProductionLines.find(l => l.id === lineId);
    if (!line) return;

    setProductions(prev => 
      prev.map(prod => 
        prod.id === productionId 
          ? { ...prod, assignedLine: line.name }
          : prod
      )
    );

    toast({
      title: "Production Line Assigned",
      description: `Production assigned to ${line.name}`,
    });
  };

  const handleStartProduction = (productionId: string) => {
    setProductions(prev => 
      prev.map(prod => 
        prod.id === productionId 
          ? { ...prod, productionStatus: "IN_PROGRESS" }
          : prod
      )
    );

    toast({
      title: "Production Started",
      description: "Production has been started successfully",
    });
  };

  const handleCompleteProduction = (productionId: string) => {
    setProductions(prev => 
      prev.map(prod => 
        prod.id === productionId 
          ? { ...prod, productionStatus: "COMPLETED" }
          : prod
      )
    );

    toast({
      title: "Production Completed",
      description: "Production has been marked as completed",
    });
  };

  const getKitStatusBadge = (status: ScheduledProductionForProduction["kitStatus"]) => {
    switch (status) {
      case "KIT SENT":
        return <Badge className="bg-blue-100 text-blue-800">Kit Sent</Badge>;
      case "KIT VERIFIED":
        return <Badge className="bg-green-100 text-green-800">Kit Verified</Badge>;
      case "KIT SCHEDULED":
        return <Badge className="bg-yellow-100 text-yellow-800">Kit Scheduled</Badge>;
      case "KIT SHORTAGE":
        return <Badge className="bg-red-100 text-red-800">Kit Shortage</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getProductionStatusBadge = (status: ScheduledProductionForProduction["productionStatus"]) => {
    switch (status) {
      case "IN_PROGRESS":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "ON_HOLD":
        return <Badge className="bg-red-100 text-red-800">On Hold</Badge>;
      case "NOT_STARTED":
        return <Badge className="bg-gray-100 text-gray-800">Not Started</Badge>;
    }
  };

  const getMaterialStatusBadge = (status: ScheduledProductionForProduction["materialStatus"]) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-green-100 text-green-800">Available</Badge>;
      case "PARTIAL":
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case "SHORTAGE":
        return <Badge className="bg-red-100 text-red-800">Shortage</Badge>;
    }
  };

  const availableLines = mockProductionLines.filter(line => line.status === "IDLE" || line.status === "SETUP");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Scheduled Productions</h3>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">
            {format(new Date(), "PPP")}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production Schedule Overview</CardTitle>
          <CardDescription>
            View all scheduled productions and assign them to production lines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Kit Status</TableHead>
                  <TableHead>Material Status</TableHead>
                  <TableHead>Assigned Line</TableHead>
                  <TableHead>Production Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((production) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">{production.voucherNumber}</TableCell>
                    <TableCell>{production.modelName}</TableCell>
                    <TableCell>{format(new Date(production.scheduledDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{production.quantity}</TableCell>
                    <TableCell>{getKitStatusBadge(production.kitStatus)}</TableCell>
                    <TableCell>{getMaterialStatusBadge(production.materialStatus)}</TableCell>
                    <TableCell>
                      {production.assignedLine ? (
                        <span className="text-sm font-medium">{production.assignedLine}</span>
                      ) : (
                        <Select onValueChange={(value) => handleAssignLine(production.id, value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Assign line" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLines.map(line => (
                              <SelectItem key={line.id} value={line.id}>
                                {line.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>{getProductionStatusBadge(production.productionStatus)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {production.kitStatus === "KIT SENT" && production.assignedLine && production.productionStatus === "NOT_STARTED" && (
                          <Button
                            size="sm"
                            onClick={() => handleStartProduction(production.id)}
                            className="flex items-center gap-1"
                          >
                            <Play className="h-3 w-3" />
                            Start
                          </Button>
                        )}
                        {production.productionStatus === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteProduction(production.id)}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
