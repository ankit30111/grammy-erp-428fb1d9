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
          customers!inner(name, brand_name),
          parts(name, part_code)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="destructive">Open</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="default">CAPA Shared</Badge>;
      case "PARTS_SENT":
        return <Badge variant="secondary">Parts Sent to IQC</Badge>;
      case "RESOLVED":
        return <Badge variant="secondary">Resolved</Badge>;
      case "CLOSED":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // customer_complaint_batch_items was dropped in the rebuild with no
  // replacement, so complaints no longer carry a DATA / PART item type.
  const getComplaintTypeIcon = (_complaint: any) => (
    <Badge variant="outline" className="text-xs">PRODUCT</Badge>
  );

  // Filter complaints
  const filteredComplaints = complaints.filter(complaint => {
    const matchesSearch = !searchTerm || 
      complaint.complaint_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.parts?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
    
    const matchesBatch = batchFilter === "all" || 
      batchFilter === "direct";
    
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
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="UNDER_REVIEW">CAPA Shared</SelectItem>
                  <SelectItem value="PARTS_SENT">Parts Sent to IQC</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
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
          <CardTitle>Individual Complaints</CardTitle>
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
                    {                    complaint.parts ? (
                      <div>
                        <div className="font-medium">{complaint.parts.name}</div>
                        <div className="text-sm text-muted-foreground">{complaint.parts.part_code}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{complaint.customers?.brand_name}</TableCell>
                  <TableCell>{format(new Date((complaint as any).complaint_date), 'MMM dd, yyyy')}</TableCell>
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