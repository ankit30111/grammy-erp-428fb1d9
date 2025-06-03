
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, FileText } from "lucide-react";
import { format } from "date-fns";

const PartAnalysis = () => {
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [remarks, setRemarks] = useState("");
  const [rcaFile, setRcaFile] = useState<File | null>(null);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch parts for analysis
  const { data: partsForAnalysis = [] } = useQuery({
    queryKey: ["parts-for-analysis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_complaint_parts")
        .select(`
          *,
          customer_complaints!inner(
            id,
            customers!inner(name),
            products!inner(name, product_code),
            brand_name,
            bill_number
          ),
          raw_materials!inner(name, material_code)
        `)
        .in("status", ["UNDER_ANALYSIS", "PENDING"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Update part analysis
  const updatePartMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("customer_complaint_parts")
        .update({
          ...updateData,
          analyzed_by: user.data.user.id,
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedPart.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Part analysis updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["parts-for-analysis"] });
      setSelectedPart(null);
      setRemarks("");
      setRcaFile(null);
      setCapaFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update part analysis",
        variant: "destructive",
      });
    },
  });

  // Close part analysis
  const closePartMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("customer_complaint_parts")
        .update({
          status: "CLOSED",
          closed_by: user.data.user.id,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedPart.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Part analysis marked as closed",
      });
      queryClient.invalidateQueries({ queryKey: ["parts-for-analysis"] });
      setSelectedPart(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to close part analysis",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (file: File, type: 'rca' | 'capa') => {
    // In a real implementation, you would upload to Supabase Storage
    // For now, we'll just simulate with a placeholder URL
    const fileUrl = `https://placeholder.com/${type}_${Date.now()}.pdf`;
    
    const updateData = {
      ...(type === 'rca' ? { rca_document_url: fileUrl } : { capa_document_url: fileUrl }),
      remarks: remarks
    };

    updatePartMutation.mutate(updateData);
  };

  const handleSaveRemarks = () => {
    updatePartMutation.mutate({ remarks });
  };

  const canClose = selectedPart?.rca_document_url && selectedPart?.capa_document_url;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "UNDER_ANALYSIS":
        return <Badge variant="warning">Under Analysis</Badge>;
      case "CLOSED":
        return <Badge variant="default">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Parts for Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Part Code</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partsForAnalysis.map((part) => (
                <TableRow key={part.id}>
                  <TableCell className="font-mono">{part.customer_complaints.bill_number}</TableCell>
                  <TableCell>{part.customer_complaints.customers?.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{part.customer_complaints.products?.name}</div>
                      <div className="text-sm text-muted-foreground">{part.customer_complaints.products?.product_code}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{part.raw_materials.material_code}</TableCell>
                  <TableCell>{part.raw_materials.name}</TableCell>
                  <TableCell>{part.reason}</TableCell>
                  <TableCell>{getStatusBadge(part.status)}</TableCell>
                  <TableCell>
                    {part.sent_to_iqc_at && format(new Date(part.sent_to_iqc_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedPart(part)}
                    >
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPart && (
        <Card>
          <CardHeader>
            <CardTitle>
              Analyze Part: {selectedPart.raw_materials.material_code} - {selectedPart.raw_materials.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div><strong>Customer:</strong> {selectedPart.customer_complaints.customers?.name}</div>
              <div><strong>Product:</strong> {selectedPart.customer_complaints.products?.name}</div>
              <div><strong>Brand:</strong> {selectedPart.customer_complaints.brand_name}</div>
              <div><strong>Serial Number:</strong> {selectedPart.serial_number}</div>
              <div><strong>Reason:</strong> {selectedPart.reason}</div>
              <div><strong>Bill Number:</strong> {selectedPart.customer_complaints.bill_number}</div>
            </div>

            <div>
              <Label>Internal Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter detailed remarks for internal traceability..."
                className="mt-2"
              />
              <Button 
                className="mt-2" 
                size="sm" 
                onClick={handleSaveRemarks}
                disabled={updatePartMutation.isPending}
              >
                Save Remarks
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Root Cause Analysis (RCA) Document</Label>
                <div className="mt-2 space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setRcaFile(e.target.files?.[0] || null)}
                  />
                  {selectedPart.rca_document_url && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <FileText className="h-4 w-4" />
                      RCA document uploaded
                    </div>
                  )}
                  <Button 
                    size="sm" 
                    onClick={() => rcaFile && handleFileUpload(rcaFile, 'rca')}
                    disabled={!rcaFile || updatePartMutation.isPending}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload RCA
                  </Button>
                </div>
              </div>

              <div>
                <Label>CAPA Document</Label>
                <div className="mt-2 space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCapaFile(e.target.files?.[0] || null)}
                  />
                  {selectedPart.capa_document_url && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <FileText className="h-4 w-4" />
                      CAPA document uploaded
                    </div>
                  )}
                  <Button 
                    size="sm" 
                    onClick={() => capaFile && handleFileUpload(capaFile, 'capa')}
                    disabled={!capaFile || updatePartMutation.isPending}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload CAPA
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={() => closePartMutation.mutate()}
                disabled={!canClose || closePartMutation.isPending}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {closePartMutation.isPending ? "Closing..." : "Mark Analysis as Closed"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedPart(null)}>
                Cancel
              </Button>
            </div>

            {!canClose && (
              <div className="text-sm text-muted-foreground">
                * Both RCA and CAPA documents must be uploaded before closing the analysis
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartAnalysis;
