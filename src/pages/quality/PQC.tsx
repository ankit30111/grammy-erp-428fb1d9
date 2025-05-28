
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const PQC = () => {
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedProduction, setSelectedProduction] = useState<string | null>(null);

  // Fetch active production orders
  const { data: activeProduction = [] } = useQuery({
    queryKey: ["active-production"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            *,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "IN_PROGRESS");
      
      return data || [];
    },
  });

  // Fetch completed production orders
  const { data: completedProduction = [] } = useQuery({
    queryKey: ["completed-production"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            *,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "COMPLETED")
        .order("updated_at", { ascending: false })
        .limit(10);
      
      return data || [];
    },
  });

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Quality Control (PQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active Production</TabsTrigger>
            <TabsTrigger value="completed">Completed Production</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Production Lines</CardTitle>
              </CardHeader>
              <CardContent>
                {activeProduction.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active production orders found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Kit Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeProduction.map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">{prod.voucher_number}</TableCell>
                          <TableCell>{prod.products?.name}</TableCell>
                          <TableCell>{prod.production_schedules?.projections?.customers?.name}</TableCell>
                          <TableCell>{prod.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {prod.kit_status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              Quality Check
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
          
          <TabsContent value="completed">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>Completed Production</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by voucher or product" className="pl-8" />
                </div>
              </CardHeader>
              <CardContent>
                {completedProduction.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed production orders found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Completion Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedProduction.map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">{prod.voucher_number}</TableCell>
                          <TableCell>{prod.products?.name}</TableCell>
                          <TableCell>{prod.production_schedules?.projections?.customers?.name}</TableCell>
                          <TableCell>{prod.quantity.toLocaleString()}</TableCell>
                          <TableCell>{new Date(prod.updated_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Report
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
          
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Quality Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Analytics data will be available once production data is collected
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PQC;
