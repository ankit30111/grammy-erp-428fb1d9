
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, FileText, Search, Filter, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";

const CAPA = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("iqc");

  // Fetch IQC CAPAs
  const { data: iqcCapas = [] } = useQuery({
    queryKey: ["iqc-capas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("iqc_vendor_capa")
        .select(`
          *,
          vendors!inner(name, vendor_code),
          grn_items!inner(
            grn!inner(grn_number),
            raw_materials!inner(name, material_code)
          )
        `)
        .order("initiated_at", { ascending: false });
      
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITED':
        return <Badge variant="secondary">Awaited</Badge>;
      case 'RECEIVED':
        return <Badge variant="outline">Received</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
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

  const filteredCapas = iqcCapas.filter(capa =>
    capa.vendors?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    capa.grn_items?.raw_materials?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    capa.grn_items?.grn?.grn_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CAPA Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* CAPA Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total CAPAs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{iqcCapas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Awaited</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {iqcCapas.filter(c => c.capa_status === 'AWAITED').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {iqcCapas.filter(c => c.capa_status === 'RECEIVED').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {iqcCapas.filter(c => {
                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  return c.capa_status !== 'APPROVED' && new Date(c.initiated_at) < sevenDaysAgo;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="iqc">IQC CAPAs</TabsTrigger>
            <TabsTrigger value="production" disabled>Production CAPAs</TabsTrigger>
            <TabsTrigger value="customer-complaints" disabled>Customer Complaint CAPAs</TabsTrigger>
            <TabsTrigger value="all">All CAPAs</TabsTrigger>
          </TabsList>

          <TabsContent value="iqc" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>IQC CAPAs</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search CAPAs..." 
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
                {filteredCapas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No IQC CAPAs found
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
                      {filteredCapas.map((capa) => (
                        <TableRow key={capa.id}>
                          <TableCell className="font-medium">
                            {capa.grn_items?.grn?.grn_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{capa.grn_items?.raw_materials?.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {capa.grn_items?.raw_materials?.material_code}
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
                          <TableCell>{getStatusBadge(capa.capa_status)}</TableCell>
                          <TableCell>
                            {format(new Date(capa.initiated_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className={getDaysOpen(capa.initiated_at) > 7 ? "text-red-600 font-medium" : ""}>
                              {getDaysOpen(capa.initiated_at)} days
                            </span>
                          </TableCell>
                          <TableCell>
                            {capa.capa_document_url ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={capa.capa_document_url} target="_blank" rel="noopener noreferrer">
                                  <FileText className="h-3 w-3 mr-1" />
                                  View
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">No document</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              View Details
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

          <TabsContent value="production" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>Production CAPAs coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer-complaints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Complaint CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>Customer complaint CAPAs coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All CAPAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p>Unified view of all CAPA types will be available here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CAPA;
