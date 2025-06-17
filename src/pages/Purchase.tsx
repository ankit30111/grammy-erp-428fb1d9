import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Clock, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useProjections } from "@/hooks/useProjections";
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
import { MaterialShortagesPage } from "@/components/Purchase/MaterialShortagesPage";
import { EditablePurchaseOrders } from "@/components/Purchase/EditablePurchaseOrders";
import { format } from "date-fns";
import { ManualPOCreationDialog } from "@/components/Purchase/ManualPOCreationDialog";

const Purchase = () => {
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});
  
  const { data: projections } = useProjections();
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

  // Fetch materials without pending POs for Create PO tab
  const { data: materialsForPO = [] } = useQuery({
    queryKey: ["materials-for-po"],
    queryFn: async () => {
      // First get materials without pending POs from the MaterialShortagesCalculated view
      const { data: shortages, error: shortagesError } = await supabase
        .from("material_shortages_calculated")
        .select("*")
        .order("shortage_quantity", { ascending: false });
      
      if (shortagesError) throw shortagesError;

      // Then get vendor information for these materials
      const materialIds = shortages?.map(s => s.raw_material_id) || [];
      
      if (materialIds.length === 0) return [];

      const { data: vendorData, error: vendorError } = await supabase
        .from("raw_material_vendors")
        .select(`
          raw_material_id,
          vendor_id,
          is_primary,
          vendors!inner(id, name, vendor_code)
        `)
        .in("raw_material_id", materialIds);
      
      if (vendorError) throw vendorError;

      // Combine shortage data with vendor information
      return shortages?.map(shortage => {
        const vendorsForMaterial = vendorData?.filter(v => v.raw_material_id === shortage.raw_material_id) || [];
        return {
          ...shortage,
          raw_material_vendors: vendorsForMaterial
        };
      }) || [];
    },
  });

  // Filter out materials that already have pending POs (that haven't been received yet)
  const availableMaterialsForPO = materialsForPO.filter(material => !material.has_pending_po);

  const handleMaterialSelect = (materialId: string, checked: boolean) => {
    if (checked) {
      setSelectedMaterials([...selectedMaterials, materialId]);
      const material = availableMaterialsForPO.find(m => m.raw_material_id === materialId);
      if (material) {
        setEditableQuantities(prev => ({
          ...prev,
          [materialId]: material.shortage_quantity
        }));
      }
    } else {
      setSelectedMaterials(selectedMaterials.filter(id => id !== materialId));
      setEditableQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[materialId];
        return newQuantities;
      });
    }
  };

  const handleQuantityChange = (materialId: string, quantity: number) => {
    setEditableQuantities(prev => ({
      ...prev,
      [materialId]: quantity
    }));
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

    const selectedMaterialData = availableMaterialsForPO.filter(m => selectedMaterials.includes(m.raw_material_id));
    const items = selectedMaterialData.map(material => ({
      raw_material_id: material.raw_material_id,
      quantity: editableQuantities[material.raw_material_id] || material.shortage_quantity,
      unit_price: 0,
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
      setEditableQuantities({});
    } catch (error) {
      console.error('Error creating PO:', error);
    }
  };

  const getAvailableVendors = () => {
    const selectedMaterialData = availableMaterialsForPO.filter(m => selectedMaterials.includes(m.raw_material_id));
    const vendorIds = new Set();
    
    selectedMaterialData.forEach(material => {
      if (material.raw_material_vendors) {
        material.raw_material_vendors.forEach((rmv: any) => {
          if (rmv.is_primary) {
            vendorIds.add(rmv.vendor_id);
          }
        });
      }
    });
    
    return vendors?.filter(v => vendorIds.has(v.id)) || [];
  };

  // Group materials by vendor for display
  const materialsByVendor = availableMaterialsForPO.reduce((acc, material) => {
    const primaryVendor = material.raw_material_vendors?.find((rmv: any) => rmv.is_primary);
    if (primaryVendor) {
      const vendorName = primaryVendor.vendors.name;
      if (!acc[vendorName]) {
        acc[vendorName] = [];
      }
      acc[vendorName].push(material);
    }
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Management</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last updated:</span>
              <span className="text-sm font-medium">{format(new Date(), 'dd-MM-yyyy, HH:mm')}</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Updated Tabs with centered navigation styling */}
        <Tabs defaultValue="material-shortages" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md rounded-lg p-1">
              <TabsTrigger 
                value="material-shortages" 
                className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium"
              >
                Material Shortages
              </TabsTrigger>
              <TabsTrigger 
                value="create-po"
                className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium"
              >
                Create PO
              </TabsTrigger>
              <TabsTrigger 
                value="purchase-orders"
                className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium"
              >
                Purchase Orders
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="material-shortages" className="space-y-4">
            <MaterialShortagesPage />
          </TabsContent>

          <TabsContent value="create-po" className="space-y-4">
            <div className="space-y-6">
              {availableMaterialsForPO.length > 0 && (
                <div className="flex items-center gap-4">
                  <Dialog open={poDialogOpen} onOpenChange={setPODialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" disabled={selectedMaterials.length === 0}>
                        <ShoppingCart className="h-4 w-4" />
                        Create PO for Selected ({selectedMaterials.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Create Purchase Order</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        </div>

                        {selectedMaterials.length > 0 && (
                          <div>
                            <Label>Selected Materials & Quantities</Label>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Material Code</TableHead>
                                  <TableHead>Material Name</TableHead>
                                  <TableHead>Shortage Qty</TableHead>
                                  <TableHead>Order Qty</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedMaterials.map((materialId) => {
                                  const material = availableMaterialsForPO.find(m => m.raw_material_id === materialId);
                                  if (!material) return null;
                                  return (
                                    <TableRow key={materialId}>
                                      <TableCell className="font-mono">{material.material_code}</TableCell>
                                      <TableCell>{material.material_name}</TableCell>
                                      <TableCell>{material.shortage_quantity}</TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={editableQuantities[materialId] || material.shortage_quantity}
                                          onChange={(e) => handleQuantityChange(materialId, parseInt(e.target.value) || 0)}
                                          className="w-24"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

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
                </div>
              )}

              {Object.entries(materialsByVendor).map(([vendor, vendorMaterials]) => (
                <Card key={vendor}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {vendor}
                      <Badge variant="destructive">
                        {vendorMaterials.length} shortages
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
                          <TableHead>Total Required</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Net Shortage</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorMaterials.map((material) => (
                          <TableRow key={material.raw_material_id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedMaterials.includes(material.raw_material_id)}
                                onChange={(e) => handleMaterialSelect(material.raw_material_id, e.target.checked)}
                                className="h-4 w-4"
                                disabled={material.has_pending_po}
                              />
                            </TableCell>
                            <TableCell className="font-medium font-mono">
                              {material.material_code}
                            </TableCell>
                            <TableCell>{material.material_name}</TableCell>
                            <TableCell>{material.total_required.toLocaleString()}</TableCell>
                            <TableCell>{material.available_quantity.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {material.shortage_quantity.toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {material.is_critical && (
                                <Badge variant="warning">Critical</Badge>
                              )}
                              {material.has_pending_po && (
                                <Badge variant="secondary">PO Created</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}

              {availableMaterialsForPO.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Materials Need PO</h3>
                    <p className="text-muted-foreground">
                      All materials with shortages already have purchase orders created
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="purchase-orders" className="space-y-4">
            <EditablePurchaseOrders />
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
