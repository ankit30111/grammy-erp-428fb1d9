
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, Eye } from "lucide-react";
import { format } from "date-fns";

interface SelectedPart {
  id: string;
  raw_material_id: string;
  name: string;
  material_code: string;
}

const CustomerComplaintHandling = () => {
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [reason, setReason] = useState("");
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customer complaints
  const { data: complaints = [] } = useQuery({
    queryKey: ["customer-complaints-oqc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_complaints")
        .select(`
          *,
          customers!inner(name),
          products!inner(name, product_code)
        `)
        .in("status", ["Open", "CAPA SHARED WITH CUSTOMER"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch BOM for selected product
  const { data: bomItems = [] } = useQuery({
    queryKey: ["product-bom", selectedComplaint?.product_id],
    queryFn: async () => {
      if (!selectedComplaint?.product_id) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(id, name, material_code)
        `)
        .eq("product_id", selectedComplaint.product_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedComplaint?.product_id,
  });

  // Send selected parts to IQC
  const sendToIQCMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const partsData = selectedParts.map(part => ({
        complaint_id: selectedComplaint.id,
        raw_material_id: part.raw_material_id,
        serial_number: serialNumber,
        reason: reason,
        status: "UNDER_ANALYSIS",
        sent_to_iqc_by: user.data.user.id,
        sent_to_iqc_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("customer_complaint_parts")
        .insert(partsData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Selected parts sent to IQC for analysis",
      });
      queryClient.invalidateQueries({ queryKey: ["customer-complaints-oqc"] });
      setSelectedComplaint(null);
      setSerialNumber("");
      setReason("");
      setSelectedParts([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send parts to IQC",
        variant: "destructive",
      });
    },
  });

  const handlePartSelection = (part: any, checked: boolean) => {
    if (checked) {
      setSelectedParts(prev => [...prev, {
        id: part.id,
        raw_material_id: part.raw_material_id,
        name: part.raw_materials.name,
        material_code: part.raw_materials.material_code
      }]);
    } else {
      setSelectedParts(prev => prev.filter(p => p.id !== part.id));
    }
  };

  const handleSendToIQC = () => {
    if (!serialNumber || !reason || selectedParts.length === 0) {
      toast({
        title: "Error",
        description: "Please fill all fields and select at least one part",
        variant: "destructive",
      });
      return;
    }
    sendToIQCMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge variant="destructive">Open</Badge>;
      case "CAPA SHARED WITH CUSTOMER":
        return <Badge variant="default">CAPA Shared</Badge>;
      case "IQC_COMPLETED":
        return <Badge variant="secondary">IQC Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Complaints for OQC Review</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Complaint Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints.map((complaint) => (
                <TableRow key={complaint.id}>
                  <TableCell>{complaint.customers?.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{complaint.products?.name}</div>
                      <div className="text-sm text-muted-foreground">{complaint.products?.product_code}</div>
                    </div>
                  </TableCell>
                  <TableCell>{complaint.brand_name}</TableCell>
                  <TableCell>{complaint.quantity}</TableCell>
                  <TableCell>{format(new Date(complaint.complaint_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedComplaint(complaint)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedComplaint && (
        <Card>
          <CardHeader>
            <CardTitle>Analyze Complaint - {selectedComplaint.products?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Serial Number</Label>
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Enter product serial number"
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER MISHANDLING">User Mishandling</SelectItem>
                    <SelectItem value="MANUFACTURING FAULT">Manufacturing Fault</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Product BOM - Select Parts for Analysis</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Material Name</TableHead>
                      <TableHead>Quantity Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedParts.some(p => p.id === item.id)}
                            onCheckedChange={(checked) => handlePartSelection(item, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                        <TableCell>{item.raw_materials.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {selectedParts.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Selected Parts ({selectedParts.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedParts.map((part) => (
                    <Badge key={part.id} variant="secondary">
                      {part.material_code} - {part.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleSendToIQC}
                disabled={sendToIQCMutation.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sendToIQCMutation.isPending ? "Sending..." : "Send Selected Parts to IQC"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerComplaintHandling;
