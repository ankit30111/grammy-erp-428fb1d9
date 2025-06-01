
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Clock, Calculator, RefreshCw, Package, Mail, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useProjections } from "@/hooks/useProjections";
import { calculateMaterialShortages, MaterialShortage } from "@/utils/materialShortageCalculator";
import { usePurchaseOrders, useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Purchase = () => {
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  
  const { data: projections } = useProjections();
  const { data: purchaseOrders } = usePurchaseOrders();
  const createPO = useCreatePurchaseOrder();
  const { toast } = useToast();

  // Fetch vendors for the dropdown
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const calculateShortages = async () => {
    if (!projections?.length) {
      toast({
        title: "No Projections",
        description: "Please add customer projections first to calculate material shortages",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    try {
      console.log('Starting shortage calculation for projections:', projections.map(p => p.id));
      const calculatedShortages = await calculateMaterialShortages(projections.map(p => p.id));
      setShortages(calculatedShortages);
      
      if (calculatedShortages.length > 0) {
        toast({
          title: "Material Shortages Calculated",
          description: `Found ${calculatedShortages.length} materials with shortages`,
        });
      } else {
        toast({
          title: "No Shortages Found",
          description: "All required materials are available in stock",
        });
      }
    } catch (error) {
      console.error('Error calculating shortages:', error);
      toast({
        title: "Calculation Error",
        description: "Failed to calculate material shortages",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Auto-calculate shortages when projections are available
  useEffect(() => {
    if (projections?.length) {
      calculateShortages();
    }
  }, [projections]);

  // Group shortages by vendor
  const shortagesByVendor = shortages.reduce((acc, shortage) => {
    const vendor = shortage.vendor_info?.name || 'Unknown Vendor';
    if (!acc[vendor]) {
      acc[vendor] = [];
    }
    acc[vendor].push(shortage);
    return acc;
  }, {} as Record<string, MaterialShortage[]>);

  const handleMaterialSelect = (materialId: string, checked: boolean) => {
    if (checked) {
      setSelectedMaterials([...selectedMaterials, materialId]);
    } else {
      setSelectedMaterials(selectedMaterials.filter(id => id !== materialId));
    }
  };

  const handleCreatePO = async () => {
    if (!selectedVendor || selectedMaterials.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select vendor and materials",
        variant: "destructive",
      });
      return;
    }

    const selectedShortages = shortages.filter(s => selectedMaterials.includes(s.raw_material_id));
    const items = selectedShortages.map(shortage => ({
      raw_material_id: shortage.raw_material_id,
      quantity: shortage.shortage_quantity,
      unit_price: 0, // User can update this later
    }));

    try {
      await createPO.mutateAsync({
        vendor_id: selectedVendor,
        items,
        notes,
        expected_delivery_date: deliveryDate,
      });

      setPODialogOpen(false);
      setSelectedMaterials([]);
      setSelectedVendor("");
      setDeliveryDate("");
      setNotes("");
      
      // Refresh shortages
      calculateShortages();
    } catch (error) {
      console.error('Error creating PO:', error);
    }
  };

  // Get available vendors for selected materials
  const getAvailableVendors = () => {
    const selectedShortages = shortages.filter(s => selectedMaterials.includes(s.raw_material_id));
    const vendorIds = new Set(selectedShortages.map(s => s.vendor_info?.id).filter(Boolean));
    return vendors?.filter(v => vendorIds.has(v.id)) || [];
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Management</h1>
          <div className="flex items-center gap-4">
            <Button 
              onClick={calculateShortages}
              disabled={isCalculating}
              className="gap-2"
            >
              {isCalculating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calculate Shortages
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last updated:</span>
              <span className="text-sm font-medium">Today, 14:35</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="shortages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="shortages">Material Shortages</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="shortages">
            <div className="space-y-6">
              {shortages.length > 0 && (
                <div className="flex items-center gap-4">
                  <Dialog open={poDialogOpen} onOpenChange={setPODialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" disabled={selectedMaterials.length === 0}>
                        <Plus className="h-4 w-4" />
                        Create PO for Selected
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Purchase Order</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Vendor</Label>
                          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableVendors().map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name} ({vendor.vendor_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Expected Delivery Date</Label>
                          <Input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Additional notes"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setPODialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreatePO} disabled={createPO.isPending}>
                            {createPO.isPending ? "Creating..." : "Create PO"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <span className="text-sm text-muted-foreground">
                    {selectedMaterials.length} materials selected
                  </span>
                </div>
              )}

              {Object.entries(shortagesByVendor).map(([vendor, vendorShortages]) => (
                <Card key={vendor}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {vendor}
                      <Badge variant="destructive">
                        {vendorShortages.length} shortages
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Material Code</TableHead>
                          <TableHead>Material Name</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Shortage</TableHead>
                          <TableHead>Critical</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorShortages.map((shortage) => (
                          <TableRow key={shortage.raw_material_id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedMaterials.includes(shortage.raw_material_id)}
                                onChange={(e) => handleMaterialSelect(shortage.raw_material_id, e.target.checked)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {shortage.material_code}
                            </TableCell>
                            <TableCell>{shortage.material_name}</TableCell>
                            <TableCell>{shortage.required_quantity}</TableCell>
                            <TableCell>{shortage.available_quantity}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {shortage.shortage_quantity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {shortage.is_critical && (
                                <Badge variant="warning">Critical</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}

              {shortages.length === 0 && !isCalculating && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Material Shortages</h3>
                    <p className="text-muted-foreground">
                      All required materials are available in stock
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="purchase-orders">
            <div className="space-y-4">
              {purchaseOrders && purchaseOrders.length > 0 ? (
                <div className="grid gap-4">
                  {purchaseOrders.map((po) => (
                    <Card key={po.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{po.po_number}</CardTitle>
                          <Badge variant={po.status === 'PENDING' ? 'warning' : 'secondary'}>
                            {po.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Vendor</p>
                            <p className="font-medium">{po.vendors?.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Amount</p>
                            <p className="font-medium">₹{po.total_amount?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Expected Delivery</p>
                            <p className="font-medium">
                              {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Items</p>
                            <p className="font-medium">{po.purchase_order_items?.length || 0} items</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Purchase Orders</h3>
                    <p className="text-muted-foreground">
                      Create purchase orders from material shortages
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {!projections?.length && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No customer projections found. Material shortages will be calculated based on projections and BOM.
                </p>
                <p className="text-sm text-muted-foreground">
                  Add customer projections first, then return here to calculate material shortages and create purchase orders.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Purchase;
