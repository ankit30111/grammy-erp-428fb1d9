import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, Search, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import LineRejectionManager from "@/components/quality/LineRejectionManager";
import IQCInspectionDialog from "@/components/quality/IQCInspectionDialog";
import PartAnalysis from "@/components/quality/PartAnalysis";

const IQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);

  // Fetch pending GRNs for IQC - only those with pending or null IQC status
  const { data: pendingGRNs = [] } = useQuery({
    queryKey: ["pending-grns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grn")
        .select(`
          *,
          vendors!inner(name),
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

  // Fetch completed GRNs - those with approved or rejected IQC status
  const { data: completedGRNs = [] } = useQuery({
    queryKey: ["completed-grns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grn")
        .select(`
          *,
          vendors!inner(name),
          grn_items!inner(
            *,
            raw_materials!inner(name, material_code)
          )
        `)
        .in("status", ["COMPLETED", "RECEIVED"])
        .order("updated_at", { ascending: false })
        .limit(20);
      
      // Filter to show only GRNs with completed IQC items
      const filteredData = data?.filter(grn => 
        grn.grn_items.some((item: any) => 
          item.iqc_status === 'APPROVED' || item.iqc_status === 'REJECTED'
        )
      ) || [];
      
      return filteredData;
    },
  });

  const handleInspectClick = (grn: any) => {
    setSelectedGRN(grn);
    setShowInspectionDialog(true);
  };

  const getStatusBadge = (grn: any) => {
    const allApproved = grn.grn_items.every((item: any) => item.iqc_status === 'APPROVED');
    const hasRejected = grn.grn_items.some((item: any) => item.iqc_status === 'REJECTED');
    const hasPending = grn.grn_items.some((item: any) => !item.iqc_status || item.iqc_status === 'PENDING');
    
    if (hasPending) return <Badge variant="secondary">Pending IQC</Badge>;
    if (hasRejected) return <Badge variant="destructive">Partially Rejected</Badge>;
    if (allApproved) return <Badge variant="default">Approved</Badge>;
    return <Badge variant="outline">In Progress</Badge>;
  };

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
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>Completed IQC</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by GRN or vendor" className="pl-8" />
                </div>
              </CardHeader>
              <CardContent>
                {completedGRNs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed IQC inspections found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Completion Date</TableHead>
                        <TableHead>Items Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedGRNs.map((grn) => (
                        <TableRow key={grn.id}>
                          <TableCell className="font-medium">{grn.grn_number}</TableCell>
                          <TableCell>{grn.vendors?.name}</TableCell>
                          <TableCell>{new Date(grn.updated_at).toLocaleDateString()}</TableCell>
                          <TableCell>{grn.grn_items?.length || 0}</TableCell>
                          <TableCell>{getStatusBadge(grn)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Report
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
