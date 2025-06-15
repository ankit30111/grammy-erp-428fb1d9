
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CAPAWidget = () => {
  const navigate = useNavigate();

  const { data: capaStats } = useQuery({
    queryKey: ["capa-stats-enhanced"],
    queryFn: async () => {
      // Fetch Vendor CAPAs
      const { data: vendorCapas } = await supabase
        .from("iqc_vendor_capa")
        .select("id, capa_status, initiated_at");
      
      // Fetch Line Rejection CAPAs
      const { data: lineRejections } = await supabase
        .from("line_rejections")
        .select(`
          id, 
          created_at,
          rca_reports!left(id, approval_status)
        `);
      
      // Fetch Part Analysis CAPAs
      const { data: partAnalysis } = await supabase
        .from("customer_complaint_parts")
        .select("id, status, created_at");
      
      // Fetch Production CAPAs
      const { data: productionCapas } = await supabase
        .from("production_capa")
        .select("id, capa_status, initiated_at");

      // Calculate vendor CAPA statistics
      const vendorStats = {
        total: vendorCapas?.length || 0,
        awaited: vendorCapas?.filter(c => c.capa_status === 'AWAITED').length || 0,
        received: vendorCapas?.filter(c => c.capa_status === 'RECEIVED').length || 0,
        overdue: vendorCapas?.filter(c => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return c.capa_status !== 'IMPLEMENTED' && new Date(c.initiated_at) < sevenDaysAgo;
        }).length || 0
      };

      // Calculate line rejection statistics
      const lineRejectionStats = {
        total: lineRejections?.length || 0,
        pending: lineRejections?.filter(lr => !lr.rca_reports || lr.rca_reports.length === 0).length || 0,
        approved: lineRejections?.filter(lr => 
          lr.rca_reports && lr.rca_reports.length > 0 && lr.rca_reports[0].approval_status === 'APPROVED'
        ).length || 0
      };

      // Calculate part analysis statistics
      const partAnalysisStats = {
        total: partAnalysis?.length || 0,
        pending: partAnalysis?.filter(pa => pa.status === 'PENDING').length || 0,
        inProgress: partAnalysis?.filter(pa => pa.status === 'IN_PROGRESS').length || 0
      };

      // Calculate production CAPA statistics
      const productionStats = {
        total: productionCapas?.length || 0,
        awaited: productionCapas?.filter(pc => pc.capa_status === 'AWAITED').length || 0,
        received: productionCapas?.filter(pc => pc.capa_status === 'RECEIVED').length || 0
      };

      return {
        vendor: vendorStats,
        lineRejection: lineRejectionStats,
        partAnalysis: partAnalysisStats,
        production: productionStats,
        totalOpen: vendorStats.awaited + vendorStats.received + lineRejectionStats.pending + 
                  partAnalysisStats.pending + partAnalysisStats.inProgress + productionStats.awaited + productionStats.received,
        totalOverdue: vendorStats.overdue
      };
    },
  });

  const stats = capaStats || { 
    vendor: { total: 0, awaited: 0, received: 0, overdue: 0 },
    lineRejection: { total: 0, pending: 0, approved: 0 },
    partAnalysis: { total: 0, pending: 0, inProgress: 0 },
    production: { total: 0, awaited: 0, received: 0 },
    totalOpen: 0,
    totalOverdue: 0
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>CAPA Management</CardTitle>
        <CardDescription>Corrective & Preventive Actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Open CAPAs:</span>
            <span className="font-medium">{stats.totalOpen}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-600" />
                Vendor:
              </span>
              <span className="font-medium">{stats.vendor.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                Line Rejection:
              </span>
              <span className="font-medium">{stats.lineRejection.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-purple-600" />
                Part Analysis:
              </span>
              <span className="font-medium">{stats.partAnalysis.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-green-600" />
                Production:
              </span>
              <span className="font-medium">{stats.production.total}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-muted-foreground">Overdue:</span>
            <span className="font-medium text-red-600">{stats.totalOverdue}</span>
          </div>
          
          <Button 
            className="w-full mt-4" 
            onClick={() => navigate("/quality/capa")}
          >
            <AlertTriangle className="h-4 w-4 mr-2" /> 
            Manage CAPAs
          </Button>
        </div>
        <div className="absolute -right-4 -top-1 opacity-10">
          <AlertTriangle className="h-24 w-24 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
};
