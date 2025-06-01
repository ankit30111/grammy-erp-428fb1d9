
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const MonthlyKitTracker = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const { data: voucherData = [] } = useQuery({
    queryKey: ["monthly-kit-tracker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules!inner(
            projections!inner(
              products!inner(name)
            )
          ),
          kit_preparation(
            status,
            kit_number
          )
        `)
        .order("scheduled_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getKitStatus = (order: any) => {
    const kitPrep = order.kit_preparation?.[0];
    if (!kitPrep) return "Scheduled";
    
    const status = kitPrep.status;
    if (status === "COMPLETE KIT SENT") return "Sent Fully";
    if (status?.includes("PARTIAL") || status?.includes("ACCESSORY") || 
        status?.includes("SUB ASSEMBLY") || status?.includes("MAIN ASSEMBLY")) {
      return "Sent Partially";
    }
    return "Scheduled";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Sent Fully": return "default";
      case "Sent Partially": return "warning";
      case "Scheduled": return "secondary";
      default: return "secondary";
    }
  };

  // Group by month
  const groupedByMonth = voucherData.reduce((acc, voucher) => {
    const monthKey = format(new Date(voucher.scheduled_date), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(voucher);
    return acc;
  }, {} as Record<string, typeof voucherData>);

  const months = Object.keys(groupedByMonth).sort().reverse();
  const filteredData = selectedMonth === "all" ? voucherData : groupedByMonth[selectedMonth] || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Kit Tracker
          </CardTitle>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {format(new Date(month + '-01'), 'MMM yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher No.</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((voucher) => (
              <TableRow key={voucher.id}>
                <TableCell className="font-mono">{voucher.voucher_number}</TableCell>
                <TableCell>{voucher.production_schedules.projections.products.name}</TableCell>
                <TableCell>{voucher.quantity}</TableCell>
                <TableCell>{format(new Date(voucher.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(getKitStatus(voucher)) as any}>
                    {getKitStatus(voucher)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No vouchers found for the selected period
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyKitTracker;
