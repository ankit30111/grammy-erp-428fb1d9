
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Search, AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import LineRejectionManager from "@/components/quality/LineRejectionManager";
import IQCInspectionDialog from "@/components/quality/IQCInspectionDialog";
import PartAnalysis from "@/components/quality/PartAnalysis";
import { IQCReportViewer } from "@/components/quality/IQCReportViewer";

const IQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"month" | "all">("month");

  // Fetch pending GRNs for IQC - only those with pending or null IQC status
  const { data: pendingGRNs = [] } = useQuery({
    queryKey: ["pending-grns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grn")
        .select(`
          *,
          vendors!inner(name),
          purchase_orders(po_number),
          grn_items!inner(
            *,
            raw_materials!inner(name, material_code)
          )
        `)
        .eq("status", "RECEIVED")
        .or("iqc_status.is.null,iqc_status.eq.PENDING", { foreignTable: "grn_items" });
      
      // Filter out GRNs where all items are already completed
      const filteredData = data?.filter(grn => 
        grn.grn_items.some((item: any) => 
          !item.iqc_status || item.iqc_status === 'PENDING'
        )
      ) || [];
      
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
          raw_material_id,
          received_quantity,
          accepted_quantity,
          rejected_quantity,
          iqc_status,
          iqc_completed_at,
          iqc_report_url,
          grn:grn_id!inner(
            id,
            grn_number,
            vendor_id,
            vendors:vendor_id!inner(name, vendor_code),
            purchase_orders(po_number)
          ),
          raw_materials:raw_material_id!inner(name, material_code),
          iqc_vendor_capa!left(
            id,
            capa_status,
            capa_document_url,
            initiated_at,
            received_at,
            approved_at,
            implemented_at
          )
        `)
        .not("iqc_status", "is", null)
        .neq("iqc_status", "PENDING")
        .in("iqc_status", ["APPROVED", "REJECTED", "SEGREGATED", "FAILED"]);

      // Apply date filter based on view mode
      if (viewMode === "month") {
        const startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        const endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1));
        query = query
          .gte("iqc_completed_at", startDate.toISOString())
          .lte("iqc_completed_at", endDate.toISOString());
      }

      const { data } = await query.order("iqc_completed_at", { ascending: false });
      
      return data || [];
    },
  });

  const handleInspectClick = (grn: any) => {
    setSelectedGRN(grn);
    setShowInspectionDialog(true);
  };

  const getStatusBadge = (grn: any) => {
    const allApproved = grn.grn_items.every((item: any) => item.iqc_status === 'APPROVED');
    const hasRejected = grn.grn_items.some((item: any) => item.iqc_status === 'REJECTED');
    const hasSegregated = grn.grn_items.some((item: any) => item.iqc_status === 'SEGREGATED');
    const hasPending = grn.grn_items.some((item: any) => !item.iqc_status || item.iqc_status === 'PENDING');
    
    if (hasPending) return <Badge variant="secondary">Pending IQC</Badge>;
    if (hasRejected) return <Badge variant="destructive">Rejected</Badge>;
    if (hasSegregated) return <Badge variant="outline">Segregated</Badge>;
    if (allApproved) return <Badge variant="default">Approved</Badge>;
    return <Badge variant="outline">Mixed Results</Badge>;
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'SEGREGATED':
        return <Badge variant="outline">Segregated</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCAPAStatusBadge = (capaData: any) => {
    if (!capaData) return <Badge variant="secondary">No CAPA</Badge>;
    
    switch (capaData.capa_status) {
      case 'AWAITED':
        return <Badge variant="secondary">CAPA Awaited</Badge>;
      case 'RECEIVED':
        return <Badge variant="outline">CAPA Received</Badge>;
      case 'APPROVED':
        return <Badge variant="default">CAPA Approved</Badge>;
      case 'IMPLEMENTED':
        return <Badge variant="default" className="bg-green-600">CAPA Implemented</Badge>;
      default:
        return <Badge variant="secondary">{capaData.capa_status}</Badge>;
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
      item.raw_materials?.name?.toLowerCase().includes(searchLower) ||
      item.raw_materials?.material_code?.toLowerCase().includes(searchLower) ||
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
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Incoming Quality Control (IQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pending">Pending IQC</TabsTrigger>
            <TabsTrigger value="completed">Completed IQC</TabsTrigger>
            <TabsTrigger value="line-rejection">Line Rejection</TabsTrigger>
            <TabsTrigger value="part-analysis">Part Analysis</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
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
          </TabsContent>
          
          <TabsContent value="completed">
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
                        const capaData = item.iqc_vendor_capa?.[0];
                        const needsCAPA = item.iqc_status === 'REJECTED' || item.iqc_status === 'SEGREGATED';
                        
                        return (
                          <TableRow key={item.id} className="h-16">
                            <TableCell className="p-2 whitespace-normal break-words font-medium">{item.grn?.grn_number}</TableCell>
                            <TableCell className="p-2 whitespace-normal break-words font-medium text-blue-600">
                              {item.grn?.purchase_orders?.po_number || "Non-PO"}
                            </TableCell>
                            <TableCell className="p-2 whitespace-normal break-words font-mono text-xs">{item.raw_materials?.material_code}</TableCell>
                            <TableCell className="p-2 whitespace-normal break-words">
                              {item.raw_materials?.name}
                            </TableCell>
                            <TableCell className="p-2 whitespace-normal break-words">
                              {item.grn?.vendors?.name}
                            </TableCell>
                            <TableCell className="p-2 text-center">{item.received_quantity}</TableCell>
                            <TableCell className="p-2 text-center">{item.accepted_quantity}</TableCell>
                            <TableCell className="p-2 text-center">{item.rejected_quantity || 0}</TableCell>
                            <TableCell className="p-2">{getItemStatusBadge(item.iqc_status)}</TableCell>
                            <TableCell className="p-2">
                              <IQCReportViewer
                                reportUrl={item.iqc_report_url}
                                itemId={item.id}
                                materialName={item.raw_materials?.name || 'Unknown Material'}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="space-y-1">
                                {needsCAPA ? getCAPAStatusBadge(capaData) : <Badge variant="secondary" className="text-xs">Not Req.</Badge>}
                                {capaData && capaData.capa_status === 'AWAITED' && (
                                  <div className="text-xs text-red-600">
                                    {getDaysOpen(capaData.initiated_at)}d
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-2 text-xs">
                              {item.iqc_completed_at 
                                ? format(new Date(item.iqc_completed_at), "dd/MM/yy")
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
          </TabsContent>

          <TabsContent value="line-rejection">
            <LineRejectionManager />
          </TabsContent>
          
          <TabsContent value="part-analysis">
            <PartAnalysis />
          </TabsContent>
          
          <TabsContent value="analytics">
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
          </TabsContent>
        </Tabs>

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
