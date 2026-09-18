import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { qualityRouteTabs } from "@/components/shell/moduleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileCheck, Search, AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import LineRejectionManager from "@/components/quality/LineRejectionManager";
import IQCInspectionDialog from "@/components/quality/IQCInspectionDialog";
import PartAnalysis from "@/components/quality/PartAnalysis";
import { IQCReportViewer } from "@/components/quality/IQCReportViewer";

const iqcTabs = [
  { id: "pending", label: "Pending IQC" },
  { id: "completed", label: "Completed IQC" },
  { id: "line-rejection", label: "Line Rejection" },
  { id: "part-analysis", label: "Part Analysis" },
  { id: "analytics", label: "Analytics" },
];

const IQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");

  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"month" | "all">("month");

  // Enhanced pending GRNs query - show ANY GRN that has at least one pending item
  const { data: pendingGRNs = [] } = useQuery({
    queryKey: ["pending-grns"],
    queryFn: async () => {
      console.log('Fetching pending GRNs...');
      
      const { data, error } = await supabase
        .from("grn")
        .select(`
          *,
          vendors!inner(name),
          purchase_orders(po_number),
          grn_items!inner(
            *,
            parts!inner(name, part_code)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching GRNs:', error);
        throw error;
      }
      
      console.log('All GRNs fetched:', data?.length);
      
      // Filter to show GRNs that have at least one item with PENDING or null IQC status
      const filteredData = data?.filter(grn => {
        const hasPendingItems = grn.grn_items.some((item: any) => 
          !item.iqc_outcome || item.iqc_outcome === 'PENDING'
        );
        
        if (hasPendingItems) {
          console.log(`GRN ${grn.grn_number} has pending items:`, 
            grn.grn_items.filter((item: any) => !item.iqc_outcome || item.iqc_outcome === 'PENDING')
          );
        }
        
        return hasPendingItems;
      }) || [];
      
      console.log('Filtered pending GRNs:', filteredData.length);
      return filteredData;
    },
  });

  // Enhanced completed IQC items query with CAPA information and filtering
  const { data: completedIQCItems = [] } = useQuery({
    queryKey: ["completed-iqc-items", viewMode, selectedMonth, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("grn_items")
        .select(`
          id,
          grn_id,
          part_id,
          received_quantity,
          iqc_accepted_quantity,
          iqc_rejected_quantity,
          iqc_outcome,
          iqc_at,
          iqc_report_url,
          grn:grn_id!inner(
            id,
            grn_number,
            vendor_id,
            vendors:vendor_id!inner(name, vendor_code),
            purchase_orders(po_number)
          ),
          parts:part_id!inner(name, part_code),
          capa!left(
            id,
            capa_number,
            status,
            document_url,
            created_at,
            closed_at
          )
        `)
        .not("iqc_outcome", "is", null)
        .neq("iqc_outcome", "PENDING")
        .in("iqc_outcome", ["ACCEPTED", "REJECTED", "PARTIAL"])
        .not('iqc_report_url', 'is', null)
        .neq('iqc_report_url', '');

      // Apply date filter based on view mode
      if (viewMode === "month") {
        const startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        const endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1));
        query = query
          .gte("iqc_at", startDate.toISOString())
          .lte("iqc_at", endDate.toISOString());
      }

      const { data, error } = await query.order("iqc_at", { ascending: false });
      // Never swallow the error. The previous version destructured only `data`,
      // so when this query failed - which it did, every time, because it
      // embedded the dropped iqc_vendor_capa table - the tab rendered an empty
      // list with no indication that anything had gone wrong.
      if (error) throw error;
      return data || [];
    },
  });

  const handleInspectClick = (grn: any) => {
    setSelectedGRN(grn);
    setShowInspectionDialog(true);
  };

  const getStatusBadge = (grn: any) => {
    const allApproved = grn.grn_items.every((item: any) => item.iqc_outcome === 'ACCEPTED');
    const hasRejected = grn.grn_items.some((item: any) => item.iqc_outcome === 'REJECTED');
    const hasSegregated = grn.grn_items.some((item: any) => item.iqc_outcome === 'PARTIAL');
    const hasPending = grn.grn_items.some((item: any) => !item.iqc_outcome || item.iqc_outcome === 'PENDING');
    
    if (hasPending) return <Badge variant="secondary">Pending IQC</Badge>;
    if (hasRejected) return <Badge variant="destructive">Rejected</Badge>;
    if (hasSegregated) return <Badge variant="outline">Segregated</Badge>;
    if (allApproved) return <Badge variant="default">Approved</Badge>;
    return <Badge variant="outline">Mixed Results</Badge>;
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'PARTIAL':
        return <Badge variant="outline">Segregated</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // The six old CAPA tables collapsed into one `capa` table whose status is an
  // enum: OPEN | SUBMITTED | ACCEPTED | REJECTED | CLOSED. The old labels
  // (capa_status AWAITED / RECEIVED / IMPLEMENTED) no longer exist, so every row
  // fell through to the default and printed "undefined".
  const getCAPAStatusBadge = (capaData: any) => {
    if (!capaData) return <Badge variant="secondary">No CAPA</Badge>;

    switch (capaData.status) {
      case 'OPEN':
        return <Badge variant="warning">CAPA open</Badge>;
      case 'SUBMITTED':
        return <Badge variant="outline">Vendor replied</Badge>;
      case 'ACCEPTED':
        return <Badge variant="default">CAPA accepted</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">CAPA rejected</Badge>;
      case 'CLOSED':
        return <Badge variant="default" className="bg-green-600">CAPA closed</Badge>;
      default:
        return <Badge variant="secondary">{capaData.status ?? "No CAPA"}</Badge>;
    }
  };

  const getDaysOpen = (initiatedAt: string) => {
    const initiated = new Date(initiatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - initiated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter completed items based on search term
  const filteredCompletedItems = completedIQCItems.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.grn?.grn_number?.toLowerCase().includes(searchLower) ||
      item.parts?.name?.toLowerCase().includes(searchLower) ||
      item.parts?.part_code?.toLowerCase().includes(searchLower) ||
      item.grn?.vendors?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Generate year options (current year and 2 years back)
  const yearOptions = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  
  // Generate month options
  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];


  return (
    <DashboardLayout>
      <PageHeader title="Quality Department" />
      <TabBar tabs={qualityRouteTabs} className="mb-3" />
      <TabBar tabs={iqcTabs} value={selectedTab} onChange={setSelectedTab} />
      <div className="grid gap-4 pt-4 md:gap-6">
        

          
          {selectedTab === "pending" && (
<div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Quality Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingGRNs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending GRNs for inspection
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN Number</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Received Date</TableHead>
                        <TableHead>Items Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGRNs.map((grn) => (
                        <TableRow key={grn.id}>
                          <TableCell className="font-medium">{grn.grn_number}</TableCell>
                          <TableCell className="font-medium text-blue-600">
                            {grn.purchase_orders?.po_number || "Non-PO GRN"}
                          </TableCell>
                          <TableCell>{grn.vendors?.name}</TableCell>
                          <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                          <TableCell>{grn.grn_items?.length || 0}</TableCell>
                          <TableCell>{getStatusBadge(grn)}</TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleInspectClick(grn)}
                            >
                              <FileCheck className="h-3 w-3 mr-1" />
                              Inspect
                            </Button>
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
              <CardHeader className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                  <CardTitle>Completed IQC Items</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by GRN or material" 
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">View:</label>
                    <Select value={viewMode} onValueChange={(value: "month" | "all") => setViewMode(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {viewMode === "month" && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Month:</label>
                        <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthOptions.map((month) => (
                              <SelectItem key={month.value} value={month.value.toString()}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Year:</label>
                        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredCompletedItems.length} items
                    {viewMode === "month" && ` for ${monthOptions.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCompletedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {completedIQCItems.length === 0 ? "No completed IQC items found" : "No items match your search criteria"}
                  </div>
                ) : (
                    <Table 
                    containerClassName="overflow-x-hidden" 
                    className="table-fixed w-full text-xs"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[8%] p-2 whitespace-normal break-words">GRN No.</TableHead>
                        <TableHead className="w-[7%] p-2 whitespace-normal break-words">PO No.</TableHead>
                        <TableHead className="w-[7%] p-2 whitespace-normal break-words">Mat. Code</TableHead>
                        <TableHead className="w-[18%] p-2 whitespace-normal break-words">Material Name</TableHead>
                        <TableHead className="w-[12%] p-2 whitespace-normal break-words">Vendor</TableHead>
                        <TableHead className="w-[5%] p-2 text-center">Rcvd</TableHead>
                        <TableHead className="w-[5%] p-2 text-center">Acc.</TableHead>
                        <TableHead className="w-[5%] p-2 text-center">Rej.</TableHead>
                        <TableHead className="w-[8%] p-2">Status</TableHead>
                        <TableHead className="w-[8%] p-2">Report</TableHead>
                        <TableHead className="w-[9%] p-2">CAPA</TableHead>
                        <TableHead className="w-[8%] p-2">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompletedItems.map((item) => {
                        const capaData = item.capa?.[0];
                        const needsCAPA = item.iqc_outcome === 'REJECTED' || item.iqc_outcome === 'PARTIAL';
                        
                        return (
                          <TableRow key={item.id} className="h-16">
                            <TableCell className="p-2 whitespace-normal break-words font-medium">{item.grn?.grn_number}</TableCell>
                            <TableCell className="p-2 whitespace-normal break-words font-medium text-blue-600">
                              {item.grn?.purchase_orders?.po_number || "Non-PO"}
                            </TableCell>
                            <TableCell className="p-2 whitespace-normal break-words font-mono text-xs">{item.parts?.part_code}</TableCell>
                            <TableCell className="p-2 whitespace-normal break-words">
                              {item.parts?.name}
                            </TableCell>
                            <TableCell className="p-2 whitespace-normal break-words">
                              {item.grn?.vendors?.name}
                            </TableCell>
                            <TableCell className="p-2 text-center">{item.received_quantity}</TableCell>
                            <TableCell className="p-2 text-center">{item.iqc_accepted_quantity}</TableCell>
                            <TableCell className="p-2 text-center">{item.iqc_rejected_quantity || 0}</TableCell>
                            <TableCell className="p-2">{getItemStatusBadge(item.iqc_outcome)}</TableCell>
                            <TableCell className="p-2">
                              <IQCReportViewer
                                reportUrl={item.iqc_report_url}
                                itemId={item.id}
                                materialName={item.parts?.name || 'Unknown Material'}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="space-y-1">
                                {needsCAPA ? getCAPAStatusBadge(capaData) : <Badge variant="secondary" className="text-xs">Not Req.</Badge>}
                                {capaData && capaData.status === 'OPEN' && (
                                  <div className="text-xs text-red-600">
                                    {getDaysOpen(capaData.created_at)}d
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-2 text-xs">
                              {item.iqc_at 
                                ? format(new Date(item.iqc_at), "dd/MM/yy")
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
)}

          {selectedTab === "line-rejection" && (
<div>
            <LineRejectionManager />
          </div>
)}
          
          {selectedTab === "part-analysis" && (
<div>
            <PartAnalysis />
          </div>
)}
          
          {selectedTab === "analytics" && (
<div>
            <Card>
              <CardHeader>
                <CardTitle>IQC Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Analytics data will be available once inspection data is collected
                </div>
              </CardContent>
            </Card>
          </div>
)}
        

        {/* IQC Inspection Dialog */}
        {selectedGRN && (
          <IQCInspectionDialog
            grn={selectedGRN}
            isOpen={showInspectionDialog}
            onClose={() => {
              setShowInspectionDialog(false);
              setSelectedGRN(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default IQC;
