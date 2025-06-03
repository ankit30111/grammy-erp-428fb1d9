
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Upload, AlertTriangle } from "lucide-react";

interface EnhancedPQCActionsDialogProps {
  productionOrderId: string;
  isOpen: boolean;
  onClose: () => void;
}

const EnhancedPQCActionsDialog = ({ productionOrderId, isOpen, onClose }: EnhancedPQCActionsDialogProps) => {
  const [selectedTab, setSelectedTab] = useState("pqc-report");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportStatus, setReportStatus] = useState("");
  const [reportRemarks, setReportRemarks] = useState("");
  const [selectedPartCode, setSelectedPartCode] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionQuantity, setRejectionQuantity] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check existing reports count for today
  const { data: todayReportsCount = 0 } = useQuery({
    queryKey: ["today-reports-count", productionOrderId],
    queryFn: async () => {
      const today = new Date().toDateString();
      const { data } = await supabase
        .from("pqc_reports")
        .select("id")
        .eq("production_order_id", productionOrderId)
        .gte("upload_date", today);
      
      return data?.length || 0;
    },
  });

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

  const uploadPQCReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("pqc_reports")
        .insert([{
          ...reportData,
          created_by: user.data.user.id,
          uploaded_by: user.data.user.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PQC report uploaded successfully",
      });
      setReportFile(null);
      setReportStatus("");
      setReportRemarks("");
      queryClient.invalidateQueries({ queryKey: ["today-reports-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload PQC report",
        variant: "destructive",
      });
    },
  });

  const createLineRejectionMutation = useMutation({
    mutationFn: async (rejectionData: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("line_rejections")
        .insert([{
          ...rejectionData,
          created_by: user.data.user.id,
          rejected_by: user.data.user.id
        }])
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
      setSelectedPartCode("");
      setRejectionReason("");
      setRejectionQuantity("");
      setRejectionRemarks("");
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

  const handleReportUpload = async () => {
    if (!reportFile || !reportStatus || !reportRemarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and select a file",
        variant: "destructive",
      });
      return;
    }

    if (todayReportsCount >= 2) {
      toast({
        title: "Upload Limit Reached",
        description: "You can only upload 2 reports per day per voucher",
        variant: "destructive",
      });
      return;
    }

    // For now, we'll store the file name. In a real implementation, you'd upload to storage
    const reportData = {
      production_order_id: productionOrderId,
      status: reportStatus,
      remarks: reportRemarks,
      time_period: new Date().getHours() < 12 ? "Morning" : "Evening",
      report_file_url: reportFile.name // In real implementation, this would be the storage URL
    };

    uploadPQCReportMutation.mutate(reportData);
  };

  const handleLineRejectionSubmit = async () => {
    if (!selectedPartCode || !rejectionReason || !rejectionQuantity || !rejectionRemarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(rejectionQuantity);
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
      reason: rejectionReason,
      quantity_rejected: quantity,
      remarks: rejectionRemarks,
    };

    createLineRejectionMutation.mutate(rejectionData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PQC Actions</DialogTitle>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pqc-report">PQC Report Upload</TabsTrigger>
            <TabsTrigger value="line-rejection">Line Rejection Entry</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pqc-report">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Upload PQC Report
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Reports uploaded today: {todayReportsCount}/2
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="report-file">Report File (PDF)</Label>
                  <Input
                    id="report-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                    disabled={todayReportsCount >= 2}
                  />
                </div>

                <div>
                  <Label htmlFor="report-status">Status</Label>
                  <Select value={reportStatus} onValueChange={setReportStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pass">Pass</SelectItem>
                      <SelectItem value="Fail">Fail</SelectItem>
                      <SelectItem value="Some Issues">Some Issues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="report-remarks">Remarks *</Label>
                  <Textarea
                    id="report-remarks"
                    value={reportRemarks}
                    onChange={(e) => setReportRemarks(e.target.value)}
                    placeholder="Enter detailed remarks..."
                    required
                  />
                </div>

                <Button 
                  onClick={handleReportUpload}
                  disabled={uploadPQCReportMutation.isPending || todayReportsCount >= 2}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadPQCReportMutation.isPending ? "Uploading..." : "Upload Report"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="line-rejection">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Line Rejection Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Select value={rejectionReason} onValueChange={setRejectionReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="User Mishandling">User Mishandling</SelectItem>
                      <SelectItem value="Part Faulty">Part Faulty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={rejectionQuantity}
                    onChange={(e) => setRejectionQuantity(e.target.value)}
                    placeholder="Enter quantity rejected"
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="rejection-remarks">Remarks</Label>
                  <Textarea
                    id="rejection-remarks"
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Enter detailed remarks..."
                  />
                </div>

                <Button 
                  onClick={handleLineRejectionSubmit}
                  disabled={createLineRejectionMutation.isPending}
                  className="w-full"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {createLineRejectionMutation.isPending ? "Recording..." : "Record Rejection"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedPQCActionsDialog;
