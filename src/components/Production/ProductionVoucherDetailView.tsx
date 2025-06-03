import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle2, PackageCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface ProductionVoucherDetailViewProps {
  voucherId: string;
  onBack: () => void;
}

const ProductionVoucherDetailView = ({ voucherId, onBack }: ProductionVoucherDetailViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production voucher data
  const { data: voucherData, isLoading: isVoucherLoading } = useQuery({
    queryKey: ["production-voucher", voucherId],
    queryFn: async () => {
      console.log(`🔍 Fetching production voucher: ${voucherId}`);
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(scheduled_date)
        `)
        .eq("id", voucherId)
        .single();
      
      if (error) {
        console.error(`❌ Error fetching production voucher ${voucherId}:`, error);
        throw error;
      }
      
      console.log(`📊 Production voucher ${voucherId}:`, data);
      return data;
    },
  });

  // Fetch BOM data for the product
  const { data: bomData, isLoading: isBomLoading } = useQuery({
    queryKey: ["bom-data", voucherData?.product_id],
    queryFn: async () => {
      if (!voucherData?.product_id) return [];
      
      console.log(`🔍 Fetching BOM data for product: ${voucherData.product_id}`);
      
      const { data, error } = await supabase
        .from("bom_items")
        .select("*")
        .eq("product_id", voucherData.product_id);
      
      if (error) {
        console.error(`❌ Error fetching BOM data for product ${voucherData.product_id}:`, error);
        throw error;
      }
      
      console.log(`📊 BOM data for product ${voucherData.product_id}:`, data);
      return data || [];
    },
    enabled: !!voucherData?.product_id,
  });

  const assignToLineMutation = useMutation({
    mutationFn: async ({ assignments }: { assignments: Record<string, string> }) => {
      console.log("🔄 Assigning production lines:", assignments);
      
      // Check if any of the assigned lines currently have ongoing production
      const { data: existingProduction } = await supabase
        .from("production_orders")
        .select("*")
        .eq("status", "IN_PROGRESS")
        .not("production_lines", "is", null);

      // Check which lines are currently occupied
      const occupiedLines = new Set<string>();
      if (existingProduction) {
        existingProduction.forEach(order => {
          const lines = order.production_lines || {};
          Object.values(lines).forEach(line => {
            if (typeof line === 'string') {
              occupiedLines.add(line);
            }
          });
        });
      }

      // Determine the status based on line availability
      const assignedLines = Object.values(assignments);
      const isAnyLineOccupied = assignedLines.some(line => occupiedLines.has(line));
      const newStatus = isAnyLineOccupied ? "SCHEDULED" : "IN_PROGRESS";

      console.log(`📊 Line status check: occupied lines = ${Array.from(occupiedLines)}, assigned lines = ${assignedLines}, new status = ${newStatus}`);

      const { data, error } = await supabase
        .from("production_orders")
        .update({
          production_lines: assignments,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", voucherId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Production line assignments saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["production-voucher", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
    },
    onError: (error) => {
      console.error("❌ Error assigning production lines:", error);
      toast({
        title: "Error",
        description: "Failed to assign production lines",
        variant: "destructive",
      });
    },
  });

  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (voucherData?.production_lines) {
      setLineAssignments(voucherData.production_lines as Record<string, string>);
    }
  }, [voucherData?.production_lines]);

  const handleLineAssignmentChange = (section: string, line: string) => {
    setLineAssignments(prev => ({ ...prev, [section]: line }));
  };

  const handleSaveAssignments = async () => {
    await assignToLineMutation.mutateAsync({ assignments: lineAssignments });
  };

  const isSaveDisabled = Object.keys(lineAssignments).length === 0;

  if (isVoucherLoading || isBomLoading) {
    return <div>Loading...</div>;
  }

  if (!voucherData) {
    return <div>Voucher not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Production
      </Button>

      <div className="flex items-center space-x-4">
        <PackageCheck className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Production Voucher Details</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Voucher Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Voucher Number</Label>
              <Input type="text" value={voucherData.voucher_number} readOnly />
            </div>
            <div>
              <Label>Product Name</Label>
              <Input type="text" value={voucherData.products?.name} readOnly />
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input type="text" value={new Date(voucherData.scheduled_date).toLocaleDateString()} readOnly />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="text" value={voucherData.quantity} readOnly />
            </div>
            <div>
              <Label>Status</Label>
              <Input type="text" value={voucherData.status} readOnly />
            </div>
            <div>
              <Label>Kit Status</Label>
              <Input type="text" value={voucherData.kit_status} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production Line Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Main Assembly Line</Label>
              <Input
                type="text"
                value={lineAssignments["main"] || ""}
                onChange={(e) => handleLineAssignmentChange("main", e.target.value)}
              />
            </div>
            <div>
              <Label>Sub Assembly Line</Label>
              <Input
                type="text"
                value={lineAssignments["sub"] || ""}
                onChange={(e) => handleLineAssignmentChange("sub", e.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleSaveAssignments}
            disabled={isSaveDisabled}
          >
            Save Assignments
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bill of Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomData.map((bomItem) => (
                <TableRow key={bomItem.id}>
                  <TableCell>{bomItem.part_code}</TableCell>
                  <TableCell>{bomItem.description}</TableCell>
                  <TableCell>{bomItem.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionVoucherDetailView;
