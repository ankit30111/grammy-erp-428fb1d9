import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = { area: string; rule: string; status: "OK" | "WARN" | "ERROR"; records: number | null; detail: string | null };

/**
 * System check: every consistency rule the ERP relies on, run against the live
 * database (system_health_check). When a screen shows something odd, this says
 * which rule is broken and which records to look at.
 */
const SystemCheck = () => {
  const { data = [], isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["system-health-check"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).rpc("system_health_check");
      if (error) throw error;
      return data ?? [];
    },
  });

  const errors = data.filter((r) => r.status === "ERROR").length;
  const warns = data.filter((r) => r.status === "WARN").length;
  const areas = [...new Set(data.map((r) => r.area))];

  return (
    <DashboardLayout>
      <PageHeader title="System Check" />
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-5 flex flex-wrap items-center gap-3">
            {error ? (
              <span className="text-destructive text-sm">{(error as any).message}</span>
            ) : errors ? (
              <span className="flex items-center gap-2 text-destructive font-medium"><XCircle className="h-5 w-5" /> {errors} rule{errors === 1 ? "" : "s"} broken</span>
            ) : (
              <span className="flex items-center gap-2 text-success font-medium"><CheckCircle2 className="h-5 w-5" /> No errors</span>
            )}
            {warns > 0 && <span className="flex items-center gap-1.5 text-warning text-sm"><AlertTriangle className="h-4 w-4" /> {warns} to look at</span>}
            <span className="text-sm text-muted-foreground ml-auto">
              {dataUpdatedAt ? `Checked ${format(dataUpdatedAt, "d MMM, HH:mm:ss")}` : ""}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} /> Run again
            </Button>
          </CardContent>
        </Card>

        {areas.map((area) => (
          <Card key={area}>
            <CardHeader className="pb-2"><CardTitle>{area}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.filter((r) => r.area === area).map((r) => (
                    <TableRow key={r.rule}>
                      <TableCell>
                        <div>{r.rule}</div>
                        {r.status !== "OK" && r.detail && <div className="text-xs text-muted-foreground mt-1 break-words">{r.detail}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "OK" ? "secondary" : r.status === "WARN" ? "warning" : "destructive"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{r.status === "OK" ? "—" : r.records}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SystemCheck;
