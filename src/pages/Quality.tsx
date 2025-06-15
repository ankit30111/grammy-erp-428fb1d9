
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ClipboardCheck, FileCheck, Layers, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Quality = () => {
  const navigate = useNavigate();

  // Fetch real statistics from database - using existing tables only
  const { data: grnStats } = useQuery({
    queryKey: ["grn-stats"],
    queryFn: async () => {
      const { data: pendingGRNs } = await supabase
        .from("grn")
        .select("id")
        .eq("status", "RECEIVED");
      
      return {
        pendingIQC: pendingGRNs?.length || 0
      };
    },
  });

  const { data: productionStats } = useQuery({
    queryKey: ["production-stats"],
    queryFn: async () => {
      const { data: activeProductions } = await supabase
        .from("production_orders")
        .select("id")
        .eq("status", "IN_PROGRESS");
      
      const { data: pendingOQC } = await supabase
        .from("production_orders")
        .select("id")
        .eq("status", "COMPLETED");

      return {
        activePQC: activeProductions?.length || 0,
        pendingOQC: pendingOQC?.length || 0
      };
    },
  });

  const { data: capaStats } = useQuery({
    queryKey: ["capa-stats"],
    queryFn: async () => {
      const { data: openCAPAs } = await supabase
        .from("vendor_capa")
        .select("id")
        .eq("status", "Open");

      const { data: pendingRCAs } = await supabase
        .from("line_rejections")
        .select(`
          id,
          rca_reports(id)
        `)
        .eq("reason", "Part Faulty");

      const pendingRCACount = pendingRCAs?.filter(rejection => 
        !rejection.rca_reports || rejection.rca_reports.length === 0
      ).length || 0;

      return {
        openCAPAs: openCAPAs?.length || 0,
        pendingRCAs: pendingRCACount
      };
    },
  });

  const stats = {
    pendingIQC: grnStats?.pendingIQC || 0,
    activePQC: productionStats?.activePQC || 0,
    pendingOQC: productionStats?.pendingOQC || 0,
    openCAPAs: capaStats?.openCAPAs || 0,
    pendingRCAs: capaStats?.pendingRCAs || 0,
    returnAnalysis: 0, // This would need a separate table for customer returns
    capaItems: 0 // Mock data for now
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quality Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Incoming Quality Control</CardTitle>
              <CardDescription>Raw material inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending GRNs:</span>
                  <span className="font-medium">{stats.pendingIQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open CAPAs:</span>
                  <span className="font-medium">{stats.capaItems}</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/iqc")}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Go to IQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <FileCheck className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Production Quality Control</CardTitle>
              <CardDescription>In-process quality checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Productions:</span>
                  <span className="font-medium">{stats.activePQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inspection Points:</span>
                  <span className="font-medium">24</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/pqc")}
                >
                  <Layers className="h-4 w-4 mr-2" /> Go to PQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <Layers className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Outgoing Quality Control</CardTitle>
              <CardDescription>Final product inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending Batches:</span>
                  <span className="font-medium">{stats.pendingOQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Returns:</span>
                  <span className="font-medium">{stats.returnAnalysis}</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/oqc")}
                >
                  <FileCheck className="h-4 w-4 mr-2" /> Go to OQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <ClipboardCheck className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>CAPA Management</CardTitle>
              <CardDescription>Vendor corrective actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open CAPAs:</span>
                  <span className="font-medium">{stats.openCAPAs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending RCAs:</span>
                  <span className="font-medium">{stats.pendingRCAs}</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/vendor-capa")}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" /> Go to CAPA
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <AlertTriangle className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">IQC Rejection Rate:</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PQC Defect Rate:</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">OQC Rejection Rate:</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Return Rate:</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0%' }}></div>
                </div>
                
                <Button variant="outline" className="w-full mt-2">
                  View Detailed Reports
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total GRNs Processed:</span>
                  <span className="font-medium">{stats.pendingIQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Productions Active:</span>
                  <span className="font-medium">{stats.activePQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending OQC:</span>
                  <span className="font-medium">{stats.pendingOQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open CAPAs:</span>
                  <span className="font-medium">{stats.openCAPAs}</span>
                </div>
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Quality control system is operational
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Quality;
