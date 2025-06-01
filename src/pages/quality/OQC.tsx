
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileCheck, CheckCircle, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const OQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production orders pending OQC
  const { data: pendingOQC = [] } = useQuery({
    queryKey: ["pending-oqc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules(
            projections(
              products(name, product_code)
            )
          )
        `)
        .eq("status", "PENDING_OQC");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch completed OQC inspections
  const { data: completedOQC = [] } = useQuery({
    queryKey: ["completed-oqc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules(
            projections(
              products(name, product_code)
            )
          )
        `)
        .in("status", ["OQC_PASSED", "OQC_FAILED"]);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation to approve/reject OQC
  const oqcInspectionMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      remarks
    }: {
      orderId: string;
      status: "OQC_PASSED" | "OQC_FAILED";
      remarks?: string;
    }) => {
      const { error } = await supabase
        .from("production_orders")
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      // If passed, create finished goods inventory entry
      if (status === "OQC_PASSED") {
        const { data: order } = await supabase
          .from("production_orders")
          .select("product_id, quantity")
          .eq("id", orderId)
          .single();

        if (order) {
          await supabase
            .from("finished_goods_inventory")
            .insert({
              product_id: order.product_id,
              quantity: order.quantity,
              quality_status: "APPROVED",
              production_date: new Date().toISOString().split('T')[0]
            });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-oqc"] });
      queryClient.invalidateQueries({ queryKey: ["completed-oqc"] });
      
      toast({
        title: "OQC Inspection Completed",
        description: `Production order ${variables.status === "OQC_PASSED" ? "passed" : "failed"} OQC inspection`,
      });
    },
    onError: (error) => {
      console.error("Error completing OQC inspection:", error);
      toast({
        title: "Error",
        description: "Failed to complete OQC inspection",
        variant: "destructive",
      });
    },
  });

  const handleOQCApproval = (orderId: string, passed: boolean) => {
    oqcInspectionMutation.mutate({
      orderId,
      status: passed ? "OQC_PASSED" : "OQC_FAILED",
      remarks: passed ? "Passed OQC inspection" : "Failed OQC inspection"
    });
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Outgoing Quality Control (OQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending OQC</TabsTrigger>
            <TabsTrigger value="completed">Completed OQC</TabsTrigger>
            <TabsTrigger value="reports">Quality Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production Orders Pending OQC</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingOQC.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No production orders pending OQC inspection
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher Number</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOQC.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.voucher_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {order.production_schedules?.projections?.products?.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.production_schedules?.projections?.products?.product_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell>{format(new Date(order.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleOQCApproval(order.id, true)}
                                disabled={oqcInspectionMutation.isPending}
                                className="gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Pass
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOQCApproval(order.id, false)}
                                disabled={oqcInspectionMutation.isPending}
                                className="gap-2"
                              >
                                <X className="h-4 w-4" />
                                Fail
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed OQC Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                {completedOQC.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed OQC inspections found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher Number</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Completed Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedOQC.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.voucher_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {order.production_schedules?.projections?.products?.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.production_schedules?.projections?.products?.product_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={order.status === "OQC_PASSED" ? "default" : "destructive"}
                            >
                              {order.status === "OQC_PASSED" ? "PASSED" : "FAILED"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.updated_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Quality Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Quality reporting functionality will be implemented
                </div>
                
                <Button className="mt-4">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Generate Quality Report
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default OQC;
