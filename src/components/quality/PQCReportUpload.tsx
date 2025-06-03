
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PQCReportUploadProps {
  productionOrderId: string;
}

const PQCReportUpload = ({ productionOrderId }: PQCReportUploadProps) => {
  const [timePeriod, setTimePeriod] = useState("");
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing PQC reports for today
  const { data: todayReports = [] } = useQuery({
    queryKey: ["pqc-reports", productionOrderId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("pqc_reports")
        .select("*")
        .eq("production_order_id", productionOrderId)
        .eq("upload_date", today)
        .order("upload_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Check which periods are already used today
  const usedPeriods = todayReports.map(report => report.time_period);
  const availablePeriods = ["morning", "evening"].filter(period => !usedPeriods.includes(period));

  const uploadReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const { data, error } = await supabase
        .from("pqc_reports")
        .insert([reportData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PQC report uploaded successfully",
      });
      // Reset form
      setTimePeriod("");
      setStatus("");
      setRemarks("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["pqc-reports"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload PQC report",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!timePeriod || !status || !remarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (availablePeriods.length === 0) {
      toast({
        title: "Upload Limit Reached",
        description: "You have already uploaded reports for both morning and evening today",
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      production_order_id: productionOrderId,
      time_period: timePeriod,
      status,
      remarks,
      report_file_url: file ? `temp_url_for_${file.name}` : null, // In real implementation, upload to storage first
    };

    uploadReportMutation.mutate(reportData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pass': return 'default';
      case 'Fail': return 'destructive';
      case 'Some Issues': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload PQC Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time-period">Time Period</Label>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time period" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeriods.map((period) => (
                      <SelectItem key={period} value={period}>
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePeriods.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    All periods used for today
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pass">Pass</SelectItem>
                    <SelectItem value="Fail">Fail</SelectItem>
                    <SelectItem value="Some Issues">Some Issues</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="file">PQC Report PDF</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks *</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter mandatory remarks..."
                required
                className="mt-1"
              />
            </div>

            <Button 
              type="submit" 
              disabled={uploadReportMutation.isPending || availablePeriods.length === 0}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadReportMutation.isPending ? "Uploading..." : "Upload Report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Today's Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {todayReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports uploaded today
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time Period</TableHead>
                  <TableHead>Upload Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="capitalize">{report.time_period}</TableCell>
                    <TableCell>
                      {new Date(report.upload_time).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(report.status) as any}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{report.remarks}</TableCell>
                    <TableCell>
                      {report.report_file_url && (
                        <Button variant="outline" size="sm">
                          <FileText className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PQCReportUpload;
