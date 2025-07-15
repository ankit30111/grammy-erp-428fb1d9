import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Filter, Package, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ComplaintStatusDialog } from "./ComplaintStatusDialog";

const IndividualComplaintsManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogComplaint, setStatusDialogComplaint] = useState<any>(null);

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
          customer_complaint_batches(receipt_type),
          customer_complaint_batch_items(item_type, part_description)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });


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
      complaint.products?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setStatusDialogComplaint(complaint);
                          setStatusDialogOpen(true);
                        }}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Status
                      </Button>
                    </div>
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


      {/* Status Dialog */}
      <ComplaintStatusDialog
        complaint={statusDialogComplaint}
        isOpen={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setStatusDialogComplaint(null);
        }}
      />
    </div>
  );
};

export default IndividualComplaintsManagement;