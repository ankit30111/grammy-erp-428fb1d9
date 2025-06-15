
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Eye, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import IQCCapaManagement from "@/components/quality/IQCCapaManagement";

const VendorCAPAManagement = () => {
  // Fetch existing vendor CAPAs (from original table)
  const { data: vendorCapas = [] } = useQuery({
    queryKey: ["vendor-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_capa")
        .select(`
          *,
          vendors!inner(name, vendor_code)
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching vendor CAPAs:", error);
        throw error;
      }
      
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <Badge variant="secondary">Open</Badge>;
      case 'In Progress':
        return <Badge variant="outline">In Progress</Badge>;
      case 'Closed':
        return <Badge variant="default">Closed</Badge>;
      case 'Rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Vendor CAPA Management</h1>
        </div>

        <Tabs defaultValue="vendor-capas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vendor-capas">Vendor CAPAs</TabsTrigger>
            <TabsTrigger value="iqc-capas">IQC CAPAs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="vendor-capas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Vendor Corrective and Preventive Actions
                </CardTitle>
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
                        <TableHead>CAPA ID</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Issue Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created Date</TableHead>
                        <TableHead>Target Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorCapas.map((capa) => (
                        <TableRow key={capa.id}>
                          <TableCell className="font-medium">
                            CAPA-{capa.id.slice(-6).toUpperCase()}
                          </TableCell>
                          <TableCell>{capa.vendors?.name}</TableCell>
                          <TableCell>{capa.issue_type}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {capa.description}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(capa.status)}
                          </TableCell>
                          <TableCell>
                            {new Date(capa.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {capa.target_closure_date 
                              ? new Date(capa.target_closure_date).toLocaleDateString()
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              {capa.capa_document_url && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => window.open(capa.capa_document_url, '_blank')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Document
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="iqc-capas">
            <IQCCapaManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default VendorCAPAManagement;
