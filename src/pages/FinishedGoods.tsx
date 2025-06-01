import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package, 
  Search, 
  Clock, 
  CheckCircle,
  Upload,
  FileText,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface FinishedGoodsItem {
  id: string;
  product_id: string;
  quantity: number;
  production_date: string;
  lot_number: string;
  quality_status: string;
  created_at: string;
  production_order_id: string | null;
  products: {
    name: string;
    product_code: string;
  };
  production_orders?: {
    voucher_number: string;
  } | null;
}

interface StockMovement {
  id: string;
  type: "INBOUND" | "OUTBOUND";
  product_id: string;
  quantity: number;
  date: string;
  reference: string;
  notes?: string;
  products: {
    name: string;
    product_code: string;
  };
}

const FinishedGoods = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Fetch real finished goods inventory from database
  const { data: finishedGoodsInventory = [], isLoading, refetch } = useQuery({
    queryKey: ["finished-goods"],
    queryFn: async () => {
      console.log('Fetching finished goods inventory...');
      
      const { data, error } = await supabase
        .from("finished_goods_inventory")
        .select(`
          *,
          products!inner(name, product_code),
          production_orders(voucher_number)
        `)
        .eq("quality_status", "APPROVED")
        .gt("quantity", 0)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error('Error fetching finished goods:', error);
        throw error;
      }
      
      console.log('Fetched finished goods inventory:', data);
      return data as FinishedGoodsItem[];
    },
  });

  // Fetch dispatch orders for stock movements
  const { data: dispatchOrders = [] } = useQuery({
    queryKey: ["dispatch-orders-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_orders")
        .select(`
          *,
          dispatch_order_items(
            id,
            product_id,
            quantity,
            products(name, product_code)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error('Error fetching dispatch orders:', error);
        throw error;
      }
      
      return data || [];
    },
  });

  // Calculate total dispatched quantities by product
  const dispatchedQuantities = dispatchOrders.reduce((acc, order) => {
    order.dispatch_order_items?.forEach(item => {
      if (!acc[item.product_id]) {
        acc[item.product_id] = 0;
      }
      acc[item.product_id] += item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  // Create stock movements from inventory and dispatch data
  const stockMovements: StockMovement[] = [
    // Inbound movements from finished goods inventory
    ...finishedGoodsInventory.map(item => ({
      id: `in-${item.id}`,
      type: "INBOUND" as const,
      product_id: item.product_id,
      quantity: item.quantity,
      date: item.production_date || item.created_at,
      reference: item.production_orders?.voucher_number || item.lot_number || 'Production',
      notes: 'OQC Approved',
      products: item.products
    })),
    // Outbound movements from dispatch orders
    ...dispatchOrders.flatMap(order => 
      order.dispatch_order_items?.map(item => ({
        id: `out-${item.id}`,
        type: "OUTBOUND" as const,
        product_id: item.product_id,
        quantity: item.quantity,
        date: order.dispatch_date,
        reference: order.dispatch_order_number,
        notes: `Dispatched to customer`,
        products: item.products
      })) || []
    )
  ];

  // Group inventory by model
  const modelStocks = finishedGoodsInventory.reduce((acc, item) => {
    const modelName = item.products.name;
    if (!acc[modelName]) {
      acc[modelName] = {
        modelName,
        totalQuantity: 0,
        dispatchedQuantity: 0,
        oldestLotDate: item.production_date,
        lots: []
      };
    }
    acc[modelName].totalQuantity += item.quantity;
    acc[modelName].lots.push(item);
    
    if (new Date(item.production_date) < new Date(acc[modelName].oldestLotDate)) {
      acc[modelName].oldestLotDate = item.production_date;
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Add dispatched quantities to model stocks
  Object.values(modelStocks).forEach((model: any) => {
    model.dispatchedQuantity = model.lots.reduce((total: number, lot: any) => {
      return total + (dispatchedQuantities[lot.product_id] || 0);
    }, 0);
  });

  const modelStocksArray = Object.values(modelStocks);
  
  const filteredInventory = finishedGoodsInventory.filter(item => {
    const matchesSearch = 
      item.products.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lot_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.products.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.production_orders?.voucher_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModel = !selectedModel || item.products.name === selectedModel;
    
    return matchesSearch && matchesModel;
  });

  const totalModels = modelStocksArray.length;
  const totalQuantity = modelStocksArray.reduce((sum, model) => sum + model.totalQuantity, 0);
  const totalDispatched = modelStocksArray.reduce((sum, model) => sum + model.dispatchedQuantity, 0);

  const calculateAge = (productionDate: string) => {
    const today = new Date();
    const prodDate = new Date(productionDate);
    const diffTime = Math.abs(today.getTime() - prodDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getAgeColor = (age: number) => {
    if (age <= 7) return "text-green-600";
    if (age <= 14) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">
          <div className="text-center">Loading finished goods inventory...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Finished Goods Inventory</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">
              {format(new Date(), "MMM dd, yyyy HH:mm")}
            </span>
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Button onClick={() => refetch()} size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center p-6">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Models</p>
                <p className="text-2xl font-bold">{totalModels}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Stock</p>
                <p className="text-2xl font-bold">{totalQuantity.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingDown className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Dispatched</p>
                <p className="text-2xl font-bold text-red-600">{totalDispatched.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Model Overview</TabsTrigger>
            <TabsTrigger value="inventory">Lot Details</TabsTrigger>
            <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
            <TabsTrigger value="movements">Stock Movement</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock by Model (FIFO Order)</CardTitle>
              </CardHeader>
              <CardContent>
                {modelStocksArray.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No finished goods inventory found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Name</TableHead>
                        <TableHead>Total Qty</TableHead>
                        <TableHead>Dispatched</TableHead>
                        <TableHead>Oldest Lot</TableHead>
                        <TableHead>Lots Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelStocksArray.map((model) => (
                        <TableRow key={model.modelName}>
                          <TableCell className="font-medium">{model.modelName}</TableCell>
                          <TableCell className="font-bold">{model.totalQuantity.toLocaleString()}</TableCell>
                          <TableCell className="text-red-600 font-medium">
                            {model.dispatchedQuantity.toLocaleString()}
                          </TableCell>
                          <TableCell>{format(new Date(model.oldestLotDate), "MMM dd")}</TableCell>
                          <TableCell>{model.lots.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models, vouchers..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              {selectedModel && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Filtered: {selectedModel}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedModel(null)}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Lots (FIFO Order)</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No finished goods inventory found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Production Voucher</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Production Date</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>OQC Report</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory
                        .sort((a, b) => new Date(a.production_date).getTime() - new Date(b.production_date).getTime())
                        .map((item) => {
                          const age = calculateAge(item.production_date);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono font-medium">
                                {item.production_orders?.voucher_number || item.lot_number || 'N/A'}
                              </TableCell>
                              <TableCell>{item.products.name}</TableCell>
                              <TableCell className="font-medium">{item.quantity.toLocaleString()}</TableCell>
                              <TableCell>{format(new Date(item.production_date), "MMM dd, yyyy")}</TableCell>
                              <TableCell className={getAgeColor(age)}>
                                {age} days
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="gap-2">
                                      <FileText className="h-4 w-4" />
                                      View Report
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>OQC Report - {item.production_orders?.voucher_number || item.lot_number}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="text-center py-8">
                                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">
                                          OQC report upload functionality will be implemented
                                        </p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aging" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {finishedGoodsInventory.filter(item => calculateAge(item.production_date) <= 7).length}
                    </div>
                    <div className="text-sm text-green-700">Fresh (≤ 7 days)</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {finishedGoodsInventory.filter(item => {
                        const age = calculateAge(item.production_date);
                        return age > 7 && age <= 14;
                      }).length}
                    </div>
                    <div className="text-sm text-yellow-700">Aging (8-14 days)</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {finishedGoodsInventory.filter(item => calculateAge(item.production_date) > 14).length}
                    </div>
                    <div className="text-sm text-red-700">Old ({'>'}14 days)</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Production Voucher</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Production Date</TableHead>
                      <TableHead>Risk Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finishedGoodsInventory
                      .sort((a, b) => calculateAge(b.production_date) - calculateAge(a.production_date))
                      .map((item) => {
                        const age = calculateAge(item.production_date);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">
                              {item.production_orders?.voucher_number || item.lot_number || 'N/A'}
                            </TableCell>
                            <TableCell>{item.products.name}</TableCell>
                            <TableCell>{item.quantity.toLocaleString()}</TableCell>
                            <TableCell className={getAgeColor(age)}>
                              {age} days
                            </TableCell>
                            <TableCell>{format(new Date(item.production_date), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              {age <= 7 && (
                                <Badge className="bg-green-100 text-green-800">Low</Badge>
                              )}
                              {age > 7 && age <= 14 && (
                                <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                              )}
                              {age > 14 && (
                                <Badge className="bg-red-100 text-red-800">High</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock Movement History</CardTitle>
              </CardHeader>
              <CardContent>
                {stockMovements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No stock movements found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>{format(new Date(movement.date), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {movement.type === "INBOUND" ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <Badge 
                                  className={movement.type === "INBOUND" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                                >
                                  {movement.type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{movement.products.name}</TableCell>
                            <TableCell className="font-medium">
                              {movement.type === "INBOUND" ? "+" : "-"}{movement.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono">{movement.reference}</TableCell>
                            <TableCell>{movement.notes || '-'}</TableCell>
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

export default FinishedGoods;
