
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { mockProductionLines } from "@/types/production";

const ProductionDashboard = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'default';
      case 'IDLE': return 'secondary';
      case 'MAINTENANCE': return 'destructive';
      case 'SETUP': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <CheckCircle className="h-4 w-4" />;
      case 'IDLE': return <Clock className="h-4 w-4" />;
      case 'MAINTENANCE': return <AlertCircle className="h-4 w-4" />;
      case 'SETUP': return <Factory className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {mockProductionLines.map((line) => (
        <Card key={line.id} className="relative">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>{line.name}</span>
              <Badge variant={getStatusColor(line.status) as any} className="gap-1">
                {getStatusIcon(line.status)}
                {line.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {line.status === 'RUNNING' || line.status === 'SETUP' ? (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Voucher:</span>
                    <span className="font-medium">{line.currentVoucher}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="font-medium">{line.currentProduct}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Operator:</span>
                    <span className="font-medium">{line.operator}</span>
                  </div>
                </div>
                
                {line.progress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress:</span>
                      <span className="font-medium">{line.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all" 
                        style={{ width: `${line.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Start:</span>
                    <br />
                    <span className="font-medium">{line.startTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. End:</span>
                    <br />
                    <span className="font-medium">{line.estimatedCompletion}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">
                  {line.status === 'IDLE' ? 'Line is idle' : 'Under maintenance'}
                </p>
                {line.operator && (
                  <p className="text-sm mt-1">
                    <span className="text-muted-foreground">Operator:</span> {line.operator}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProductionDashboard;
