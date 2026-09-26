import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { qualityRouteTabs } from "@/components/shell/moduleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, CheckCircle, X, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { attachParentVouchers } from "@/utils/voucherLinks";
import ProductionDetailsDialog from "@/components/Production/ProductionDetailsDialog";
import CustomerComplaintHandling from "@/components/quality/CustomerComplaintHandling";


const isSubAssembly = (order: any) => order?.parts?.source_type === "ASSEMBLED_STOCKED";

/** Who the output is for: the customer, the finished-good voucher, or stock. */
const forLabel = (order: any) =>
  order.production_schedules?.projections?.customers?.name
  ?? (order.parent?.voucher_number ? `For ${order.parent.voucher_number}` : "Stock build");

const OQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production orders pending OQC (COMPLETED status)
  const { data: pendingOQC = [] } = useQuery({
    queryKey: ["pending-oqc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          parts!part_id(name, part_code, source_type),
          production_schedules!inner(
            production_lines (
              name
            ),
            projections(
              customers(name)
            )
          )
        `)
        .eq("status", "COMPLETED")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return attachParentVouchers(data || []);
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
          parts!part_id(name, part_code, source_type),
          production_schedules!inner(
            production_lines (
              name
            ),
            projections(
              customers(name)
            )
          )
        `)
        .in("status", ["OQC_PASSED", "OQC_FAILED"])
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return attachParentVouchers(data || []);
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
      // Book the output in first, then mark the voucher. The booking is
      // idempotent, so a retry after a failed status update cannot double it.
      //   finished good -> finished-goods store
      //   sub-assembly  -> Main Store, ready to be issued to the finished-good kit
      if (status === "OQC_PASSED") {
        const { error: fgError } = await supabase.rpc("receive_finished_goods", {
          p_production_order_id: orderId,
        });
        if (fgError) throw fgError;
      }

      const { error } = await supabase
        .from("production_orders")
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-oqc"] });
      queryClient.invalidateQueries({ queryKey: ["completed-oqc"] });
      queryClient.invalidateQueries({ queryKey: ["finished-goods"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["subassembly-positions"] });

      const order = [...pendingOQC].find((o: any) => o.id === variables.orderId) as any;
      const passed = variables.status === "OQC_PASSED";
      toast({
        title: passed ? "OQC passed" : "OQC failed",
        description: !passed
          ? `${order?.voucher_number ?? "Voucher"} failed OQC - nothing was booked into stock`
          : isSubAssembly(order)
            ? `${order.parts?.part_code} x ${order.produced_quantity || order.quantity} received into Main Store`
            : `${order?.parts?.part_code ?? "Output"} booked into Finished Goods`,
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

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <PageHeader title="Quality Department" />
      <TabBar tabs={qualityRouteTabs} className="mb-3" />
      <TabBar
        tabs={[
          { id: "pending", label: "Pending OQC", count: pendingOQC.length },
          { id: "completed", label: "Completed OQC" },
          { id: "complaints", label: "Customer Complaint Handling" },
          { id: "reports", label: "Quality Reports" },
        ]}
        value={selectedTab}
        onChange={setSelectedTab}
      />
      <div className="grid gap-4 pt-4 md:gap-6">
        

          
          {selectedTab === "pending" && (
<div className="space-y-4">
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
                        <TableHead>Voucher</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>For</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Production Line</TableHead>
                        <TableHead>Completed Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOQC.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium font-mono whitespace-nowrap">{order.voucher_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.parts?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {order.parts?.part_code}
                                {isSubAssembly(order) && <div><Badge variant="outline" className="mt-1 whitespace-nowrap">Sub-assembly</Badge></div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{forLabel(order)}</TableCell>
                          <TableCell>{order.quantity} units</TableCell>
                          <TableCell>{order.production_schedules?.production_lines?.name}</TableCell>
                          <TableCell>{format(new Date(order.updated_at), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant="warning">
                              Pending OQC
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleViewDetails(order)}
                                className="gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                Details
                              </Button>
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
          </div>
)}
          
          {selectedTab === "completed" && (
<div>
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
                        <TableHead>For</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Completed Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedOQC.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono whitespace-nowrap">{order.voucher_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.parts?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {order.parts?.part_code}
                                {isSubAssembly(order) && <div><Badge variant="outline" className="mt-1 whitespace-nowrap">Sub-assembly</Badge></div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{forLabel(order)}</TableCell>
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
          </div>
)}
          
          {selectedTab === "complaints" && (
<div>
            <CustomerComplaintHandling />
          </div>
)}
          
          {selectedTab === "reports" && (
<div>
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
          </div>
)}
        

        <ProductionDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          productionOrder={selectedOrder}
        />
      </div>
    </DashboardLayout>
  );
};

export default OQC;
