
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ProductionDashboard = () => {
  const { data: productionLines = [] } = useQuery({
    queryKey: ["production-lines"],
    queryFn: async () => {
      // Fetch real production lines from database when available
      const { data } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name)
        `)
        .eq("status", "IN_PROGRESS");
      
      return data || [];
    },
  });

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

  if (productionLines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No active production lines found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {productionLines.map((line) => (
        <Card key={line.id} className="relative">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Production Order {line.voucher_number}</span>
              <Badge variant={getStatusColor(line.status) as any} className="gap-1">
                {getStatusIcon(line.status)}
                {line.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-medium">{line.products?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-medium">{line.quantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kit Status:</span>
                <span className="font-medium">{line.kit_status}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProductionDashboard;
