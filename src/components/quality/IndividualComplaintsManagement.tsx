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
import { Send, Eye, Search, Filter, Package } from "lucide-react";
import { format } from "date-fns";

interface SelectedPart {
  id: string;
  raw_material_id: string;
  name: string;
  material_code: string;
}

const IndividualComplaintsManagement = () => {
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [reason, setReason] = useState("");
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch individual complaints
  const { data: complaints = [] } = useQuery({
    queryKey: ["individual-complaints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_complaints")
        .select(`
          *,
          customers!inner(name),
          products(name, product_code),
          customer_complaint_batches(batch_number, receipt_type),
          customer_complaint_batch_items(item_type, part_description)
        `)
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
      queryClient.invalidateQueries({ queryKey: ["individual-complaints"] });
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

  const getComplaintTypeIcon = (complaint: any) => {
    if (complaint.customer_complaint_batch_items?.item_type === 'DATA') {
      return <Badge variant="outline" className="text-xs">DATA</Badge>;
    }
    if (complaint.customer_complaint_batch_items?.item_type === 'PART') {
      return <Badge variant="outline" className="text-xs">PART</Badge>;
    }
    return <Badge variant="outline" className="text-xs">PRODUCT</Badge>;
  };

  // Filter complaints
  const filteredComplaints = complaints.filter(complaint => {
    const matchesSearch = !searchTerm || 
      complaint.complaint_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.customer_complaint_batches?.batch_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
    
    const matchesBatch = batchFilter === "all" || 
      (batchFilter === "batch" && complaint.batch_id) ||
      (batchFilter === "direct" && !complaint.batch_id);
    
    return matchesSearch && matchesStatus && matchesBatch;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search complaints, customers, products..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="CAPA SHARED WITH CUSTOMER">CAPA Shared</SelectItem>
                  <SelectItem value="IQC_COMPLETED">IQC Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Source Filter</Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="batch">From Batch</SelectItem>
                  <SelectItem value="direct">Direct Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setBatchFilter("all");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complaints List */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Complaints ({filteredComplaints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint #</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product/Item</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.map((complaint) => (
                <TableRow key={complaint.id}>
                  <TableCell className="font-mono text-sm">{complaint.complaint_number}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {complaint.customer_complaint_batches?.batch_number || '-'}
                  </TableCell>
                  <TableCell>{getComplaintTypeIcon(complaint)}</TableCell>
                  <TableCell>{complaint.customers?.name}</TableCell>
                  <TableCell>
                    {complaint.customer_complaint_batch_items?.item_type === 'PART' ? (
                      <div className="text-sm">
                        <div className="font-medium">Faulty Part</div>
                        <div className="text-muted-foreground">{complaint.customer_complaint_batch_items.part_description}</div>
                      </div>
                    ) : complaint.customer_complaint_batch_items?.item_type === 'DATA' ? (
                      <div className="text-sm">
                        <div className="font-medium">Data Analysis</div>
                        <div className="text-muted-foreground">No physical product</div>
                      </div>
                    ) : complaint.products ? (
                      <div>
                        <div className="font-medium">{complaint.products.name}</div>
                        <div className="text-sm text-muted-foreground">{complaint.products.product_code}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{complaint.brand_name}</TableCell>
                  <TableCell>{format(new Date(complaint.complaint_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedComplaint(complaint)}
                      disabled={complaint.status === 'IQC_COMPLETED'}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {complaint.status === 'IQC_COMPLETED' ? 'Completed' : 'Process'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredComplaints.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No complaints found matching your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complaint Processing Modal */}
      {selectedComplaint && (
        <Card>
          <CardHeader>
            <CardTitle>
              Process Complaint - {selectedComplaint.complaint_number}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {selectedComplaint.customer_complaint_batches?.batch_number && (
                <span>From batch: {selectedComplaint.customer_complaint_batches.batch_number}</span>
              )}
            </div>
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

            {/* Only show BOM selection for products */}
            {selectedComplaint.products && (
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
            )}

            {/* For non-product complaints */}
            {!selectedComplaint.products && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {selectedComplaint.customer_complaint_batch_items?.item_type === 'DATA' ? 
                    'This is a data-only complaint. No BOM analysis required.' :
                    'This is a parts-only complaint. Direct IQC analysis will be performed.'
                  }
                </p>
              </div>
            )}

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
                disabled={sendToIQCMutation.isPending || (!serialNumber || !reason || (selectedComplaint.products && selectedParts.length === 0))}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sendToIQCMutation.isPending ? "Sending..." : "Send to IQC"}
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

export default IndividualComplaintsManagement;