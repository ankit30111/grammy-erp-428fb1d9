
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, User, AlertTriangle, CheckCircle, XCircle, Wrench } from "lucide-react";
import { ProductionLine, mockProductionLines } from "@/types/production";

export default function ProductionDashboard() {
  const [productionLines] = useState<ProductionLine[]>(mockProductionLines);

  const getStatusColor = (status: ProductionLine["status"]) => {
    switch (status) {
      case "RUNNING":
        return "bg-green-100 text-green-800";
      case "SETUP":
        return "bg-blue-100 text-blue-800";
      case "MAINTENANCE":
        return "bg-red-100 text-red-800";
      case "IDLE":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: ProductionLine["status"]) => {
    switch (status) {
      case "RUNNING":
        return <CheckCircle className="h-4 w-4" />;
      case "SETUP":
        return <Clock className="h-4 w-4" />;
      case "MAINTENANCE":
        return <Wrench className="h-4 w-4" />;
      case "IDLE":
        return <XCircle className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Production Lines Status</h2>
        <Badge variant="outline" className="text-sm">
          Last Updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {productionLines.map((line) => (
          <Card key={line.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{line.name}</CardTitle>
                {getStatusIcon(line.status)}
              </div>
              <Badge className={getStatusColor(line.status)}>
                {line.status.replace("_", " ")}
              </Badge>
            </CardHeader>
            <CardContent>
              {line.status === "RUNNING" || line.status === "SETUP" ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Current Production</p>
                    <p className="font-semibold">{line.currentProduct}</p>
                    <p className="text-sm text-gray-500">Voucher: {line.currentVoucher}</p>
                  </div>
                  
                  {line.progress !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{line.progress}%</span>
                      </div>
                      <Progress value={line.progress} className="h-2" />
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <User className="h-4 w-4 mr-1" />
                    <span>{line.operator}</span>
                  </div>
                  
                  {line.startTime && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Started: {line.startTime}</span>
                    </div>
                  )}
                  
                  {line.estimatedCompletion && (
                    <div className="text-sm text-gray-600">
                      <span>Est. Completion: {line.estimatedCompletion}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">
                    {line.status === "IDLE" ? "Line Available" : "Under Maintenance"}
                  </p>
                  {line.operator && (
                    <div className="flex items-center justify-center text-sm text-gray-600 mt-2">
                      <User className="h-4 w-4 mr-1" />
                      <span>{line.operator}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
