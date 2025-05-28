
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const OQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");

  // Fetch production orders ready for OQC
  const { data: pendingOQC = [] } = useQuery({
    queryKey: ["pending-oqc"],
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
        .eq("status", "COMPLETED");
      
      return data || [];
    },
  });

  // Fetch finished goods inventory
  const { data: finishedGoods = [] } = useQuery({
    queryKey: ["finished-goods"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finished_goods_inventory")
        .select(`
          *,
          products!inner(name)
        `)
        .order("created_at", { ascending: false });
      
      return data || [];
    },
  });

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Outgoing Quality Control (OQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending OQC</TabsTrigger>
            <TabsTrigger value="completed">Completed OQC</TabsTrigger>
            <TabsTrigger value="inventory">Finished Goods</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production Batches Pending OQC</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingOQC.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No production batches pending OQC
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
                      {pendingOQC.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">{batch.voucher_number}</TableCell>
                          <TableCell>{batch.products?.name}</TableCell>
                          <TableCell>{batch.production_schedules?.projections?.customers?.name}</TableCell>
                          <TableCell>{batch.quantity.toLocaleString()}</TableCell>
                          <TableCell>{new Date(batch.updated_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button size="sm">
                              Begin OQC
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
                <CardTitle>Completed Inspections</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by voucher or product" className="pl-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No completed OQC inspections found
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Finished Goods Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                {finishedGoods.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No finished goods in inventory
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Lot Number</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Quality Status</TableHead>
                        <TableHead>Production Date</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finishedGoods.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.products?.name}</TableCell>
                          <TableCell>{item.lot_number || 'Not assigned'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.quality_status === 'APPROVED' ? 'default' : 'secondary'}
                            >
                              {item.quality_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.production_date ? new Date(item.production_date).toLocaleDateString() : 'Not set'}</TableCell>
                          <TableCell>{item.location || 'Not assigned'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default OQC;
