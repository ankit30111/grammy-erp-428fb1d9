
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface LineRejectionFormProps {
  productionOrderId: string;
}

const LineRejectionForm = ({ productionOrderId }: LineRejectionFormProps) => {
  const [selectedPartCode, setSelectedPartCode] = useState("");
  const [reason, setReason] = useState("");
  const [quantityRejected, setQuantityRejected] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch BOM items for this production order
  const { data: bomItems = [] } = useQuery({
    queryKey: ["production-bom", productionOrderId],
    queryFn: async () => {
      const { data: productionOrder } = await supabase
        .from("production_orders")
        .select("product_id")
        .eq("id", productionOrderId)
        .single();

      if (!productionOrder) return [];

      const { data: bom } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(material_code, name)
        `)
        .eq("product_id", productionOrder.product_id);

      return bom || [];
    },
  });

  // Fetch active employees for user mishandling selection
  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code, position")
        .eq("status", "active")
        .order("first_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing line rejections for this production order with employee data
  const { data: lineRejections = [] } = useQuery({
    queryKey: ["line-rejections", productionOrderId],
    queryFn: async () => {
      const { data: rejections, error } = await supabase
        .from("line_rejections")
        .select(`
          *,
          raw_materials!inner(material_code, name)
        `)
        .eq("production_order_id", productionOrderId)
        .order("rejection_date", { ascending: false });
      
      if (error) throw error;

      // Manually fetch employee data for rejections with rejected_by
      const rejectionsWithEmployees = await Promise.all(
        (rejections || []).map(async (rejection) => {
          if (rejection.rejected_by && rejection.reason === "User Mishandling") {
            const { data: employee } = await supabase
              .from("employees")
              .select("id, first_name, last_name, employee_code, position")
              .eq("id", rejection.rejected_by)
              .single();
            
            return {
              ...rejection,
              employee: employee
            };
          }
          return {
            ...rejection,
            employee: null
          };
        })
      );

      return rejectionsWithEmployees;
    },
  });

  const createRejectionMutation = useMutation({
    mutationFn: async (rejectionData: any) => {
      const { data, error } = await supabase
        .from("line_rejections")
        .insert([rejectionData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Line rejection recorded successfully",
      });
      // Reset form
      setSelectedPartCode("");
      setReason("");
      setQuantityRejected("");
      setRemarks("");
      setSelectedEmployee("");
      queryClient.invalidateQueries({ queryKey: ["line-rejections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record line rejection",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPartCode || !reason || !quantityRejected || !remarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (reason === "User Mishandling" && !selectedEmployee) {
      toast({
        title: "Validation Error",
        description: "Please select the employee responsible for the mishandling",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(quantityRejected);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    const rejectionData = {
      production_order_id: productionOrderId,
      raw_material_id: selectedPartCode,
      reason,
      quantity_rejected: quantity,
      remarks,
      rejected_by: reason === "User Mishandling" ? selectedEmployee : null,
    };

    createRejectionMutation.mutate(rejectionData);
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'User Mishandling': return 'secondary';
      case 'Part Faulty': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Line Rejection Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="part-code">Part Code</Label>
                <Select value={selectedPartCode} onValueChange={setSelectedPartCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select part code" />
                  </SelectTrigger>
                  <SelectContent>
                    {bomItems.map((item) => (
                      <SelectItem key={item.raw_material_id} value={item.raw_material_id}>
                        {item.raw_materials.material_code} - {item.raw_materials.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reason">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User Mishandling">User Mishandling</SelectItem>
                    <SelectItem value="Part Faulty">Part Faulty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reason === "User Mishandling" && (
              <div>
                <Label htmlFor="employee">Responsible Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.employee_code} - {employee.first_name} {employee.last_name} ({employee.position})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="quantity">Quantity Rejected</Label>
              <Input
                id="quantity"
                type="number"
                value={quantityRejected}
                onChange={(e) => setQuantityRejected(e.target.value)}
                placeholder="Enter quantity rejected"
                min="1"
                required
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter detailed remarks..."
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={createRejectionMutation.isPending}
              className="w-full"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {createRejectionMutation.isPending ? "Recording..." : "Record Rejection"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Line Rejections */}
      <Card>
        <CardHeader>
          <CardTitle>Line Rejections History</CardTitle>
        </CardHeader>
        <CardContent>
          {lineRejections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No line rejections recorded
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineRejections.map((rejection) => (
                  <TableRow key={rejection.id}>
                    <TableCell>
                      {new Date(rejection.rejection_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {rejection.raw_materials.material_code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getReasonColor(rejection.reason) as any}>
                        {rejection.reason}
                      </Badge>
                    </TableCell>
                    <TableCell>{rejection.quantity_rejected}</TableCell>
                    <TableCell>
                      {rejection.reason === "User Mishandling" && rejection.employee ? (
                        <span className="text-sm">
                          {rejection.employee.employee_code} - {rejection.employee.first_name} {rejection.employee.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{rejection.remarks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LineRejectionForm;
