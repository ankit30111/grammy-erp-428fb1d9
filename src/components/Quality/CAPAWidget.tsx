
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileX, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CAPAWidget = () => {
  const navigate = useNavigate();

  const { data: capaStats } = useQuery({
    queryKey: ["capa-stats"],
    queryFn: async () => {
      // Fetch IQC CAPAs
      const { data: iqcCapas } = await supabase
        .from("iqc_vendor_capa")
        .select("id, capa_status, initiated_at");
      
      // Calculate statistics
      const totalOpen = iqcCapas?.filter(c => c.capa_status !== 'APPROVED').length || 0;
      const pendingApprovals = iqcCapas?.filter(c => c.capa_status === 'RECEIVED').length || 0;
      
      // Calculate overdue (older than 7 days and not approved)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const overdue = iqcCapas?.filter(c => 
        c.capa_status !== 'APPROVED' && 
        new Date(c.initiated_at) < sevenDaysAgo
      ).length || 0;

      return {
        totalOpen,
        pendingApprovals,
        overdue
      };
    },
  });

  const stats = capaStats || { totalOpen: 0, pendingApprovals: 0, overdue: 0 };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>CAPA Management</CardTitle>
        <CardDescription>Corrective & Preventive Actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Open:</span>
            <span className="font-medium">{stats.totalOpen}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pending Approval:</span>
            <span className="font-medium">{stats.pendingApprovals}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Overdue:</span>
            <span className="font-medium text-red-600">{stats.overdue}</span>
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={() => navigate("/quality/capa")}
          >
            <FileX className="h-4 w-4 mr-2" /> Manage CAPAs
          </Button>
        </div>
        <div className="absolute -right-4 -top-1 opacity-10">
          <AlertTriangle className="h-24 w-24 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
};
