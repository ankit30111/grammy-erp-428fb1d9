
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

const MonthlyKitLog = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: kitLogs = [] } = useQuery({
    queryKey: ["monthly-kit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            quantity,
            scheduled_date,
            production_schedules!inner(
              projections!inner(
                products!inner(name)
              )
            )
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getKitStatus = (status: string) => {
    switch (status) {
      case 'COMPLETE KIT SENT':
        return 'Sent Fully';
      case 'PARTIAL KIT SENT':
      case 'ACCESSORY COMPONENTS SENT':
      case 'SUB ASSEMBLY COMPONENTS SENT':
      case 'MAIN ASSEMBLY COMPONENTS SENT':
        return 'Sent Partially';
      default:
        return 'Scheduled';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Sent Fully': return 'default';
      case 'Sent Partially': return 'warning';
      case 'Scheduled': return 'secondary';
      default: return 'secondary';
    }
  };

  // Group kits by month
  const groupedKits = kitLogs.reduce((acc, kit) => {
    const monthKey = format(new Date(kit.production_orders.scheduled_date), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(kit);
    return acc;
  }, {} as Record<string, typeof kitLogs>);

  const months = Object.keys(groupedKits).sort().reverse();

  const filteredKits = selectedMonth === "all" 
    ? kitLogs 
    : groupedKits[selectedMonth] || [];

  const finalFilteredKits = statusFilter === "all" 
    ? filteredKits 
    : filteredKits.filter(kit => {
        const status = getKitStatus(kit.status);
        return statusFilter === "scheduled" ? status === "Scheduled" :
               statusFilter === "dispatched" ? status !== "Scheduled" : true;
      });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Monthly Kit Log
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(parseISO(month + '-01'), 'MMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Only Scheduled</SelectItem>
              <SelectItem value="dispatched">Only Dispatched</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher Number</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kit Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finalFilteredKits.map((kit) => (
              <TableRow key={kit.id}>
                <TableCell className="font-mono">{kit.production_orders.voucher_number}</TableCell>
                <TableCell>{kit.production_orders.production_schedules.projections.products.name}</TableCell>
                <TableCell>{kit.production_orders.quantity}</TableCell>
                <TableCell>{format(new Date(kit.production_orders.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(getKitStatus(kit.status)) as any}>
                    {getKitStatus(kit.status)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{kit.kit_number}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {finalFilteredKits.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No kit logs found for the selected filters
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyKitLog;
