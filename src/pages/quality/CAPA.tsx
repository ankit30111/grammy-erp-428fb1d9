import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { qualityRouteTabs } from "@/components/shell/moduleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Filter, Download, Upload, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import CAPAUploadDialog from "@/components/quality/CAPAUploadDialog";
import { SignedStorageLink } from "@/components/ui/signed-storage-link";

const capaTabs = [
  { id: "vendor", label: "Vendor CAPAs" },
  { id: "line-rejection", label: "Line Rejection CAPAs" },
  { id: "part-analysis", label: "Part Analysis CAPAs" },
  { id: "production", label: "Production CAPAs" },
];


const CAPA = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("vendor");
  const [capaUploadDialog, setCAPAUploadDialog] = useState<{
    isOpen: boolean;
    capaId: string;
    capaType: 'vendor' | 'production' | 'line_rejection' | 'part_analysis';
    itemDetails: any;
  }>({
    isOpen: false,
    capaId: "",
    capaType: "vendor",
    itemDetails: {}
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Vendor CAPAs - including AWAITED and RECEIVED statuses
  const { data: vendorCapas = [] } = useQuery({
    queryKey: ["vendor-capas"],
    queryFn: async () => {
      // iqc_vendor_capa collapsed into `capa` (source = 'IQC' / 'VENDOR').
      // capa_status -> status, capa_document_url -> document_url,
      // initiated_at -> created_at, AWAITED -> OPEN, RECEIVED -> SUBMITTED.
      const { data, error } = await supabase
        .from("capa")
        .select(`
          *,
          vendors(name, vendor_code),
          grn_items(
            grn(grn_number),
            parts(name, part_code)
          )
        `)
        .in('source', ['IQC', 'VENDOR'])
        .in('status', ['OPEN', 'SUBMITTED'])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Line Rejection CAPAs
  const { data: lineRejectionCapas = [] } = useQuery({
    queryKey: ["line-rejection-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_rejections")
        .select(`
          *,
          parts!inner(name, part_code),
          production_orders!inner(voucher_number),
          rca_reports!left(
            id,
            report_url,
            capa(status)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Part Analysis CAPAs
  const { data: partAnalysisCapas = [] } = useQuery({
    queryKey: ["part-analysis-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_complaint_parts")
        .select(`
          *,
          customer_complaints!inner(
            id,
            complaint_details,
            customers!inner(name)
          ),
          parts!inner(name, part_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Production CAPAs
  const { data: productionCapas = [] } = useQuery({
    queryKey: ["production-capas"],
    queryFn: async () => {
      // production_capa collapsed into `capa` (source = 'PRODUCTION').
      const { data, error } = await supabase
        .from("capa")
        .select(`
          *,
          production_orders(
            voucher_number,
            parts(name, part_code)
          )
        `)
        .eq('source', 'PRODUCTION')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // CAPA Upload mutation - updates status to RECEIVED and sets received_at
  const uploadCAPAMutation = useMutation({
    mutationFn: async ({ capaId, capaType }: { capaId: string; capaType: string }) => {
      if (capaType !== 'vendor' && capaType !== 'production') {
        throw new Error("Invalid CAPA type for upload");
      }

      // One `capa` table now; RECEIVED is SUBMITTED in capa_status.
      const { error } = await supabase
        .from("capa")
        .update({ status: 'SUBMITTED' })
        .eq("id", capaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-capas'] });
      queryClient.invalidateQueries({ queryKey: ['production-capas'] });
      toast({
        title: "CAPA Uploaded Successfully",
        description: "CAPA has been submitted for approval review",
      });
    },
    onError: (error) => {
      console.error("Error uploading CAPA:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload CAPA document",
        variant: "destructive",
      });
    },
  });

  // Calculate KPI statistics - updated to include RECEIVED status
  const kpiStats = {
    vendor: {
      total: vendorCapas.length,
      awaited: vendorCapas.filter(c => c.status === 'OPEN').length,
      received: vendorCapas.filter(c => c.status === 'SUBMITTED').length,
      overdue: vendorCapas.filter(c => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return c.status === 'OPEN' && new Date(c.created_at) < sevenDaysAgo;
      }).length,
    },
    lineRejection: {
      total: lineRejectionCapas.length,
      pending: lineRejectionCapas.filter(c => !c.rca_reports || (c.rca_reports as any[]).length === 0).length,
      rcaSubmitted: lineRejectionCapas.filter(c => (c.rca_reports as any)?.[0]?.capa?.status === 'SUBMITTED').length,
      approved: lineRejectionCapas.filter(c => (c.rca_reports as any)?.[0]?.capa?.status === 'ACCEPTED').length,
    },
    partAnalysis: {
      total: partAnalysisCapas.length,
      pending: partAnalysisCapas.filter(c => c.status === 'PENDING').length,
      inProgress: partAnalysisCapas.filter(c => c.status === 'IN_PROGRESS').length,
      capaReceived: partAnalysisCapas.filter(c => c.status === 'CAPA_RECEIVED').length,
      closed: partAnalysisCapas.filter(c => c.status === 'CLOSED').length,
    },
    production: {
      total: productionCapas.length,
      awaited: productionCapas.filter(c => c.status === 'OPEN').length,
      received: productionCapas.filter(c => c.status === 'SUBMITTED').length,
      approved: productionCapas.filter(c => c.status === 'ACCEPTED').length,
      implemented: productionCapas.filter(c => c.status === 'CLOSED').length,
    }
  };

  const getStatusBadge = (status: string, type: string = 'vendor') => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="secondary">Awaiting CAPA</Badge>;
      case 'SUBMITTED':
        return <Badge variant="outline">Under Review</Badge>;
      case 'ACCEPTED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="outline">In Progress</Badge>;
      case 'CAPA_RECEIVED':
        return <Badge variant="outline">CAPA Received</Badge>;
      case 'CLOSED':
        return <Badge variant="default">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysOpen = (initiatedAt: string) => {
    const initiated = new Date(initiatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - initiated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleCAPAUpload = (capaId: string, capaType: 'vendor' | 'production' | 'line_rejection' | 'part_analysis', itemDetails: any) => {
    setCAPAUploadDialog({
      isOpen: true,
      capaId,
      capaType,
      itemDetails
    });
  };

  const handleCAPAUploadSuccess = (capaId: string, capaType: string) => {
    uploadCAPAMutation.mutate({ capaId, capaType });
  };

  return (
    <DashboardLayout>
      <PageHeader title="Quality Department" />
      <TabBar tabs={qualityRouteTabs} className="mb-3" />
      <TabBar tabs={capaTabs} value={selectedTab} onChange={setSelectedTab} />
      <div className="grid gap-4 pt-4 md:gap-6">


        {/* Enhanced KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Vendor CAPAs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.vendor.total}</div>
              <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                <div>Awaiting Upload: <span className="font-medium text-warning">{kpiStats.vendor.awaited}</span></div>
                <div>Under Review: <span className="font-medium text-primary">{kpiStats.vendor.received}</span></div>
                <div>Overdue: <span className="font-medium text-destructive">{kpiStats.vendor.overdue}</span></div>
                <div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Line Rejection CAPAs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.lineRejection.total}</div>
              <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                <div>Pending: <span className="font-medium text-warning">{kpiStats.lineRejection.pending}</span></div>
                <div>RCA Submitted: <span className="font-medium text-primary">{kpiStats.lineRejection.rcaSubmitted}</span></div>
                <div>Approved: <span className="font-medium text-success">{kpiStats.lineRejection.approved}</span></div>
                <div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4 text-purple-600" />
                Part Analysis CAPAs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.partAnalysis.total}</div>
              <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                <div>Pending: <span className="font-medium text-warning">{kpiStats.partAnalysis.pending}</span></div>
                <div>In Progress: <span className="font-medium text-primary">{kpiStats.partAnalysis.inProgress}</span></div>
                <div>CAPA Received: <span className="font-medium text-warning">{kpiStats.partAnalysis.capaReceived}</span></div>
                <div>Closed: <span className="font-medium text-success">{kpiStats.partAnalysis.closed}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Production CAPAs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.production.total}</div>
              <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                <div>Awaited: <span className="font-medium text-warning">{kpiStats.production.awaited}</span></div>
                <div>Received: <span className="font-medium text-primary">{kpiStats.production.received}</span></div>
                <div>Approved: <span className="font-medium text-success">{kpiStats.production.approved}</span></div>
                <div>Implemented: <span className="font-medium text-success">{kpiStats.production.implemented}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        


          {selectedTab === "vendor" && (
<div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>Vendor CAPAs</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search vendor CAPAs..." 
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {vendorCapas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendor CAPAs found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN Number</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Initiated Date</TableHead>
                        <TableHead>Days Open</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorCapas.map((capa) => (
                        <TableRow key={capa.id}>
                          <TableCell className="font-medium">
                            {capa.grn_items?.grn?.grn_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{capa.grn_items?.parts?.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {capa.grn_items?.parts?.part_code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{capa.vendors?.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {capa.vendors?.vendor_code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(capa.status)}</TableCell>
                          <TableCell>
                            {format(new Date(capa.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className={getDaysOpen(capa.created_at) > 7 ? "text-destructive font-medium" : ""}>
                              {getDaysOpen(capa.created_at)} days
                            </span>
                          </TableCell>
                          <TableCell>
                            {capa.document_url ? (
                              <SignedStorageLink
                                bucket="capa-documents"
                                path={capa.document_url}
                                variant="outline"
                                size="sm"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View
                              </SignedStorageLink>
                            ) : (
                              <span className="text-muted-foreground text-sm">No document</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {capa.status === 'OPEN' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCAPAUpload(capa.id, 'vendor', {
                                    materialName: capa.grn_items?.parts?.name,
                                    vendorName: capa.vendors?.name,
                                    grnNumber: capa.grn_items?.grn?.grn_number
                                  })}
                                  className="gap-1"
                                >
                                  <Upload className="h-3 w-3" />
                                  Upload CAPA
                                </Button>
                              )}
                              {capa.status === 'SUBMITTED' && (
                                <Badge variant="outline">Under Review</Badge>
                              )}
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </div>
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

          {selectedTab === "line-rejection" && (
<div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Line Rejection CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                {lineRejectionCapas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No line rejection CAPAs found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Production Order</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Rejected Qty</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>RCA Status</TableHead>
                        <TableHead>Rejection Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineRejectionCapas.map((rejection) => {
                        const rcaReport: any = (rejection.rca_reports as any)?.[0];
                        return (
                          <TableRow key={rejection.id}>
                            <TableCell className="font-medium">
                              {rejection.production_orders?.voucher_number}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{rejection.parts?.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {rejection.parts?.part_code}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{rejection.quantity}</TableCell>
                            <TableCell>{rejection.defect}</TableCell>
                            <TableCell>
                              {rcaReport ? getStatusBadge(rcaReport.capa?.status ?? 'SUBMITTED', 'rca') : getStatusBadge('PENDING', 'rca')}
                            </TableCell>
                            <TableCell>
                              {format(new Date(rejection.created_at), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {!rcaReport && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleCAPAUpload(rejection.id, 'line_rejection', {
                                      productionOrder: rejection.production_orders?.voucher_number,
                                      materialName: rejection.parts?.name
                                    })}
                                    className="gap-1"
                                  >
                                    <Upload className="h-3 w-3" />
                                    Upload RCA
                                  </Button>
                                )}
                                {rcaReport && rcaReport.report_url && (
                                  <SignedStorageLink
                                    bucket="capa-documents"
                                    path={rcaReport.report_url}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    View RCA
                                  </SignedStorageLink>
                                )}
                                <Button variant="outline" size="sm">
                                  View Details
                                </Button>
                              </div>
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

          {selectedTab === "part-analysis" && (
<div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Part Analysis CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                {partAnalysisCapas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No part analysis CAPAs found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Complaint ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Analysis Date</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partAnalysisCapas.map((part) => (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">
                            #{part.customer_complaints?.id?.slice(-6)}
                          </TableCell>
                          <TableCell>{part.customer_complaints?.customers?.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{part.parts?.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {part.parts?.part_code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(part.status, 'part')}</TableCell>
                          <TableCell>
                            {part.created_at ? format(new Date(part.created_at), "dd/MM/yyyy") : '-'}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              Not available after rebuild
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {(part.status === 'IN_PROGRESS' || part.status === 'PENDING') && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleCAPAUpload(part.id, 'part_analysis', {
                                    complaintId: part.customer_complaints?.id?.slice(-6),
                                    materialName: part.parts?.name
                                  })}
                                  className="gap-1"
                                >
                                  <Upload className="h-3 w-3" />
                                  Upload CAPA
                                </Button>
                              )}
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </div>
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

          {selectedTab === "production" && (
<div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                {productionCapas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <h3 className="text-lg font-medium mb-2">No Production CAPAs Found</h3>
                    <p className="text-muted-foreground">
                      All production orders have passed OQC without quality issues.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Production Order</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Initiated Date</TableHead>
                        <TableHead>Days Open</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionCapas.map((capa) => (
                        <TableRow key={capa.id}>
                          <TableCell className="font-medium">
                            {capa.production_orders?.voucher_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{capa.production_orders?.parts?.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {capa.production_orders?.parts?.part_code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(capa.status)}</TableCell>
                          <TableCell>
                            {format(new Date(capa.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className={getDaysOpen(capa.created_at) > 7 ? "text-destructive font-medium" : ""}>
                              {getDaysOpen(capa.created_at)} days
                            </span>
                          </TableCell>
                          <TableCell>
                            {capa.document_url ? (
                              <SignedStorageLink
                                bucket="capa-documents"
                                path={capa.document_url}
                                variant="outline"
                                size="sm"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View
                              </SignedStorageLink>
                            ) : (
                              <span className="text-muted-foreground text-sm">No document</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {capa.status === 'OPEN' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCAPAUpload(capa.id, 'production', {
                                    productionOrder: capa.production_orders?.voucher_number
                                  })}
                                  className="gap-1"
                                >
                                  <Upload className="h-3 w-3" />
                                  Upload CAPA
                                </Button>
                              )}
                              {capa.status === 'SUBMITTED' && (
                                <Badge variant="outline">Under Review</Badge>
                              )}
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </div>
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
        

        {/* CAPA Upload Dialog */}
        <CAPAUploadDialog
          isOpen={capaUploadDialog.isOpen}
          onClose={() => setCAPAUploadDialog({ isOpen: false, capaId: "", capaType: "vendor", itemDetails: {} })}
          capaId={capaUploadDialog.capaId}
          capaType={capaUploadDialog.capaType}
          itemDetails={capaUploadDialog.itemDetails}
          onUploadSuccess={(capaId, capaType) => handleCAPAUploadSuccess(capaId, capaType)}
        />
      </div>
    </DashboardLayout>
  );
};

export default CAPA;
