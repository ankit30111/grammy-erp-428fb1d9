import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package } from "lucide-react";
import { useState } from "react";
import { useProjections } from "@/hooks/useProjections";
import { usePurchaseOrders, useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useShortages } from "@/hooks/useShortages";
import { usePlantId } from "@/hooks/usePlantId";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MaterialShortagesPage } from "@/components/Purchase/MaterialShortagesPage";
import { EditablePurchaseOrders } from "@/components/Purchase/EditablePurchaseOrders";
import { ManualPOCreationDialog } from "@/components/Purchase/ManualPOCreationDialog";

const purchaseTabs = [
  { id: "material-shortages", label: "Material Shortages" },
  { id: "create-po", label: "Create PO" },
  { id: "purchase-orders", label: "Purchase Orders" },
];

const Purchase = () => {
  const [activeTab, setActiveTab] = useState("material-shortages");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loadingDate, setLoadingDate] = useState("");
  const [isImport, setIsImport] = useState(false);
  const [originCountry, setOriginCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});

  const plantId = usePlantId();
  const { data: projections } = useProjections();
  const { data: shortages = [] } = useShortages(plantId);
  const createPO = useCreatePurchaseOrder();
  const { toast } = useToast();

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, vendor_code, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Shortage lines that are short and not already covered by a purchase order item.
  const availableMaterialsForPO = shortages.filter(
    (line) => line.shortage > 0 && !line.purchase_order_item_id,
  );

  const handleMaterialSelect = (partId: string, checked: boolean) => {
    if (checked) {
      setSelectedMaterials([...selectedMaterials, partId]);
      const line = availableMaterialsForPO.find((m) => m.part_id === partId);
      if (line) {
        setEditableQuantities((prev) => ({ ...prev, [partId]: line.shortage }));
      }
    } else {
      setSelectedMaterials(selectedMaterials.filter((id) => id !== partId));
      setEditableQuantities((prev) => {
        const next = { ...prev };
        delete next[partId];
        return next;
      });
    }
  };

  const handleQuantityChange = (partId: string, quantity: number) => {
    setEditableQuantities((prev) => ({ ...prev, [partId]: quantity }));
  };

  const handleCreatePO = async () => {
    if (!selectedVendor || selectedMaterials.length === 0) {
      toast({
        title: "Missing information",
        description: "Choose a vendor and at least one part",
        variant: "destructive",
      });
      return;
    }

    const lines = availableMaterialsForPO.filter((m) => selectedMaterials.includes(m.part_id));
    const items = lines.map((line) => ({
      part_id: line.part_id,
      quantity: editableQuantities[line.part_id] || line.shortage,
      unit_price: Number(line.unit_price || 0),
      shortage_id: line.shortage_id,
    }));

    try {
      await createPO.mutateAsync({
        vendor_id: selectedVendor,
        items,
        notes,
        is_import: isImport,
        origin_country: isImport ? originCountry || null : null,
        promised_loading_date: isImport ? loadingDate || null : null,
        promised_delivery_date: deliveryDate || null,
      });

      setPODialogOpen(false);
      setSelectedMaterials([]);
      setSelectedVendor("");
      setDeliveryDate("");
      setLoadingDate("");
      setIsImport(false);
      setOriginCountry("");
      setNotes("");
      setEditableQuantities({});
    } catch (error) {
      console.error("Error creating PO:", error);
    }
  };

  const availableVendors = (() => {
    const lines = availableMaterialsForPO.filter((m) => selectedMaterials.includes(m.part_id));
    const vendorIds = new Set(lines.map((l) => l.vendor_id).filter(Boolean));
    const preferred = vendors?.filter((v) => vendorIds.has(v.id)) || [];
    return preferred.length > 0 ? preferred : vendors || [];
  })();

  const materialsByVendor = availableMaterialsForPO.reduce((acc, line) => {
    const vendorName = line.vendor_name || "No vendor set";
    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(line);
    return acc;
  }, {} as Record<string, typeof availableMaterialsForPO>);

  return (
    <DashboardLayout>
      <PageHeader title="Purchase" />
      <TabBar tabs={purchaseTabs} value={activeTab} onChange={setActiveTab} />
      <div className="grid gap-4 pt-4 md:gap-6">
        {activeTab === "material-shortages" && <MaterialShortagesPage />}

        {activeTab === "create-po" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {availableMaterialsForPO.length > 0 && (
                <Dialog open={poDialogOpen} onOpenChange={setPODialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={selectedMaterials.length === 0}>
                      <ShoppingCart className="h-4 w-4" />
                      Create PO for Selected ({selectedMaterials.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                              {availableVendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name} ({vendor.vendor_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Promised Delivery Date</Label>
                          <Input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox
                            id="is-import"
                            checked={isImport}
                            onCheckedChange={(checked) => setIsImport(checked as boolean)}
                          />
                          <Label htmlFor="is-import">Imported purchase</Label>
                        </div>
                        {isImport && (
                          <>
                            <div>
                              <Label>Country of Origin</Label>
                              <Input
                                value={originCountry}
                                onChange={(e) => setOriginCountry(e.target.value)}
                                placeholder="e.g. China"
                              />
                            </div>
                            <div>
                              <Label>Promised Loading Date</Label>
                              <Input
                                type="date"
                                value={loadingDate}
                                onChange={(e) => setLoadingDate(e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {selectedMaterials.length > 0 && (
                        <div>
                          <Label>Selected Parts &amp; Quantities</Label>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Part Code</TableHead>
                                <TableHead>Part Name</TableHead>
                                <TableHead>Shortage Qty</TableHead>
                                <TableHead>Order Qty</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedMaterials.map((partId) => {
                                const line = availableMaterialsForPO.find((m) => m.part_id === partId);
                                if (!line) return null;
                                return (
                                  <TableRow key={partId}>
                                    <TableCell className="font-mono">{line.part_code}</TableCell>
                                    <TableCell>{line.name}</TableCell>
                                    <TableCell>{line.shortage.toLocaleString()}</TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={editableQuantities[partId] ?? line.shortage}
                                        onChange={(e) =>
                                          handleQuantityChange(partId, parseFloat(e.target.value) || 0)
                                        }
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
              )}

              <ManualPOCreationDialog />
            </div>

            {Object.entries(materialsByVendor).map(([vendor, vendorMaterials]) => (
              <Card key={vendor}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {vendor}
                    <Badge variant="destructive">{vendorMaterials.length} shortages</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Part Code</TableHead>
                        <TableHead>Part Name</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Hold</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Needed On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorMaterials.map((line) => (
                        <TableRow key={line.part_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedMaterials.includes(line.part_id)}
                              onCheckedChange={(checked) =>
                                handleMaterialSelect(line.part_id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium font-mono">{line.part_code}</TableCell>
                          <TableCell>{line.name}</TableCell>
                          <TableCell>{line.required.toLocaleString()}</TableCell>
                          <TableCell>{line.available.toLocaleString()}</TableCell>
                          <TableCell>{line.hold.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={line.balance < 0 ? "destructive" : "secondary"}>
                              {line.balance.toLocaleString()}
                            </Badge>
                          </TableCell>
                          <TableCell>{line.needed_on || "—"}</TableCell>
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
                  <h3 className="text-lg font-medium mb-2">No parts need a purchase order</h3>
                  <p className="text-muted-foreground">
                    Every short part is already covered by a purchase order.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "purchase-orders" && <EditablePurchaseOrders />}

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
                  No customer projections found. Shortages are worked out from projections and the bill of materials.
                </p>
                <p className="text-sm text-muted-foreground">
                  Add projections first, then return here to see shortages and raise purchase orders.
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
