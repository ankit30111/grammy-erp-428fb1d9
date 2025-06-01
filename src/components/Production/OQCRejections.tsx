import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const OQCRejections = () => {
  // Fetch OQC rejections (failed OQC inspections)
  const { data: oqcRejections = [] } = useQuery({
    queryKey: ["oqc-rejections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            production_line,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "OQC_FAILED")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            OQC Rejections ({oqcRejections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {oqcRejections.length > 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              OQC rejections functionality will be implemented here
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No OQC rejections found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OQCRejections;
