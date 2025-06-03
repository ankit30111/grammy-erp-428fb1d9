import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Factory, Package, CheckCircle, Play } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import HourlyProductionEntry from "./HourlyProductionEntry";
import ProductionCompletionDialog from "./ProductionCompletionDialog";

interface ProductionLineDetailViewProps {
  lineName: string;
  onBack: () => void;
}

const ProductionLineDetailView = ({ lineName, onBack }: ProductionLineDetailViewProps) => {
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production orders assigned to this line
  const { data: lineProduction = [] } = useQuery({
    queryKey: ["line-production", lineName],
    queryFn: async () => {
      console.log(`🔍 Fetching production for line: ${lineName}`);
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name)
        `)
        .in("status", ["IN_PROGRESS", "SCHEDULED"])
        .not("production_lines", "is", null)
        .order("scheduled_date", { ascending: true });
      
      if (error) {
        console.error(`❌ Error fetching line production for ${lineName}:`, error);
        throw error;
      }
      
      // Filter orders that are assigned to this specific line
      const filteredData = (data || []).filter(order => {
        const productionLines = order.production_lines || {};
        const isAssigned = Object.values(productionLines).includes(lineName);
        console.log(`Order ${order.voucher_number}: assigned to ${lineName} = ${isAssigned}`);
        return isAssigned;
      });
      
      console.log(`📊 Line ${lineName} production:`, filteredData);
      return filteredData;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch hourly production data
  const { data: hourlyData = [] } = useQuery({
    queryKey: ["hourly-production", lineName],
    queryFn: async () => {
      const voucherIds = lineProduction.map(p => p.id);
      if (voucherIds.length === 0) return [];

      const { data, error } = await supabase
        .from("hourly_production")
        .select("*")
        .in("production_order_id", voucherIds)
        .order("hour", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: lineProduction.length > 0,
  });

  const ongoingProduction = lineProduction.filter(p => p.status === "IN_PROGRESS");
  const scheduledProduction = lineProduction.filter(p => p.status === "SCHEDULED");
  const isLineEmpty = ongoingProduction.length === 0;

  const getTotalProduced = (voucherId: string) => {
    return hourlyData
      .filter(h => h.production_order_id === voucherId)
      .reduce((sum, h) => sum + h.production_units, 0);
  };

  const getCompletionPercentage = (voucher: any) => {
    const totalProduced = getTotalProduced(voucher.id);
    return Math.round((totalProduced / voucher.quantity) * 100);
  };

  // Mark production complete mutation
  const completeProductionMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ 
          status: "COMPLETED",
          updated_at: new Date().toISOString()
        })
        .eq("id", voucherId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Production Completed",
        description: "Production voucher has been marked as completed",
      });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
      setShowCompletionDialog(false);
    },
  });

  // Start production mutation
  const startProductionMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ 
          status: "IN_PROGRESS",
          updated_at: new Date().toISOString()
        })
        .eq("id", voucherId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Production Started",
        description: "Production has been started for this voucher",
      });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Production Lines
        </Button>
        <div className="text-sm text-muted-foreground">
          {lineName} - Real-time sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Factory className="h-6 w-6" />
        <h2 className="text-xl font-semibold">{lineName} - Detailed View</h2>
      </div>

      {/* Ongoing Production Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ongoing Production ({ongoingProduction.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ongoingProduction.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ongoing production on this line
            </div>
          ) : (
            <div className="space-y-4">
              {ongoingProduction.map((voucher) => {
                const totalProduced = getTotalProduced(voucher.id);
                const completionPercentage = getCompletionPercentage(voucher);
                const isComplete = totalProduced >= voucher.quantity;

                return (
                  <Card key={voucher.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Voucher:</span>
                          <p className="font-medium">{voucher.voucher_number}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Product:</span>
                          <p className="font-medium">{voucher.products?.name}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Target Quantity:</span>
                          <p className="font-medium">{voucher.quantity}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Progress:</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={isComplete ? "default" : "secondary"}>
                              {totalProduced} / {voucher.quantity} ({completionPercentage}%)
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <HourlyProductionEntry 
                          voucherId={voucher.id}
                          voucherNumber={voucher.voucher_number}
                        />
                        
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedVoucher(voucher.id);
                            setShowCompletionDialog(true);
                          }}
                          disabled={!isComplete}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark Production Complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Queue ({scheduledProduction.length})
            {!isLineEmpty && (
              <Badge variant="secondary" className="ml-2">Line Occupied</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledProduction.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No vouchers scheduled for this line
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Voucher Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledProduction.map((voucher, index) => (
                  <TableRow key={voucher.id}>
                    <TableCell>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{voucher.voucher_number}</TableCell>
                    <TableCell>{voucher.products?.name}</TableCell>
                    <TableCell>{voucher.quantity}</TableCell>
                    <TableCell>{new Date(voucher.scheduled_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Queued</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => startProductionMutation.mutate(voucher.id)}
                        disabled={!isLineEmpty || index !== 0}
                        className="gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Production
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Production Completion Dialog */}
      {showCompletionDialog && selectedVoucher && (
        <ProductionCompletionDialog
          voucherId={selectedVoucher}
          isOpen={showCompletionDialog}
          onClose={() => {
            setShowCompletionDialog(false);
            setSelectedVoucher(null);
          }}
          onComplete={(voucherId) => completeProductionMutation.mutate(voucherId)}
        />
      )}
    </div>
  );
};

export default ProductionLineDetailView;
