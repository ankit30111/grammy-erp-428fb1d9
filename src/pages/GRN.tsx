
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, Clock, Edit, Search, Filter, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useGRN, useDeleteGRN } from "@/hooks/useGRN";
import GRNForm from "@/components/PPC/GRNForm";
import { NonPOGRNForm } from "@/components/PPC/NonPOGRNForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const GRN = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [selectedGRN, setSelectedGRN] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGRN, setEditingGRN] = useState<any>(null);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [useNonPOMode, setUseNonPOMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGrnToDelete] = useState<any>(null);
  
  const { data: existingGRNs, isLoading: grnLoading, refetch } = useGRN();
  const deleteGRNMutation = useDeleteGRN();
  const { toast } = useToast();

  const handleEditGRN = (grn: any) => {
    setEditingGRN(grn);
    const quantities: Record<string, number> = {};
    grn.grn_items?.forEach((item: any) => {
      quantities[item.id] = item.received_quantity;
    });
    setEditQuantities(quantities);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingGRN) return;

    try {
      // Update each GRN item with new quantities
      const updates = Object.entries(editQuantities).map(([itemId, quantity]) => {
        return supabase
          .from('grn_items')
          .update({ received_quantity: quantity })
          .eq('id', itemId);
      });

      await Promise.all(updates);

      toast({
        title: "GRN Updated",
        description: "GRN quantities have been updated successfully",
      });

      setEditDialogOpen(false);
      setEditingGRN(null);
      setEditQuantities({});
      refetch();
    } catch (error) {
      console.error('Error updating GRN:', error);
      toast({
        title: "Error",
        description: "Failed to update GRN",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGRN = (grn: any) => {
    setGrnToDelete(grn);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteGRN = async () => {
    if (!grnToDelete) return;

    try {
      await deleteGRNMutation.mutateAsync(grnToDelete.id);
      setDeleteDialogOpen(false);
      setGrnToDelete(null);
      refetch();
    } catch (error) {
      console.error('Error deleting GRN:', error);
    }
  };

  // Check if GRN can be deleted (all items must have PENDING IQC status)
  const canDeleteGRN = (grn: any) => {
    return grn.grn_items?.every((item: any) => 
      !item.iqc_status || item.iqc_status === 'PENDING'
    ) || false;
  };

  // Filter GRNs based on search query
  const filteredGRNs = existingGRNs?.filter(grn => 
    grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grn.vendors?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grn.purchase_orders?.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Received</Badge>;
      case 'IQC_COMPLETED':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">IQC Completed</Badge>;
      case 'STORE_RECEIVED':
        return <Badge variant="default">Store Received</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Goods Receipt Note (GRN)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              <Package className="h-4 w-4 mr-2" />
              Create GRN
            </TabsTrigger>
            <TabsTrigger value="tracking">
              <Clock className="h-4 w-4 mr-2" />
              GRN Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Create GRN</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="grn-mode" className="text-sm font-medium">
                      {useNonPOMode ? "Without PO" : "With PO"}
                    </Label>
                    <Switch
                      id="grn-mode"
                      checked={useNonPOMode}
                      onCheckedChange={setUseNonPOMode}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {useNonPOMode 
                    ? "Create GRN for direct material receipts without a purchase order"
                    : "Create GRN based on approved purchase orders"
                  }
                </p>
              </CardHeader>
            </Card>
            
            {useNonPOMode ? <NonPOGRNForm /> : <GRNForm />}
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>GRN Tracking</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search GRN, PO, or vendor..."
                      className="pl-8 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {grnLoading ? (
                  <div className="text-center py-8">Loading GRNs...</div>
                ) : filteredGRNs && filteredGRNs.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GRN Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>PO Reference</TableHead>
                          <TableHead>Items Count</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredGRNs.map((grn) => (
                          <TableRow key={grn.id}>
                            <TableCell className="font-medium">{grn.grn_number}</TableCell>
                            <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                            <TableCell>{grn.vendors?.name || 'N/A'}</TableCell>
                            <TableCell className="text-blue-600 font-medium">
                              {grn.purchase_orders?.po_number || (
                                <span className="text-muted-foreground italic">Non-PO</span>
                              )}
                            </TableCell>
                            <TableCell>{grn.grn_items?.length || 0}</TableCell>
                            <TableCell>{getStatusBadge(grn.status)}</TableCell>
                            <TableCell className="space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedGRN(selectedGRN === grn.id ? null : grn.id)}
                              >
                                {selectedGRN === grn.id ? "Hide Details" : "View Details"}
                              </Button>
                              {grn.status === 'RECEIVED' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditGRN(grn)}
                                  className="gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                              )}
                              {canDeleteGRN(grn) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeleteGRN(grn)}
                                  className="gap-1 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {selectedGRN && (
                      <div className="mt-6 border-t pt-4">
                        <h3 className="text-lg font-medium mb-4">GRN Details: {filteredGRNs.find(grn => grn.id === selectedGRN)?.grn_number}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Status</span>
                            <p className="font-medium">
                              {filteredGRNs.find(grn => grn.id === selectedGRN)?.status}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">PO Reference</span>
                            <p className="font-medium">
                              {filteredGRNs.find(grn => grn.id === selectedGRN)?.purchase_orders?.po_number || (
                                <span className="text-muted-foreground italic">Non-PO GRN</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Vendor</span>
                            <p className="font-medium">
                              {filteredGRNs.find(grn => grn.id === selectedGRN)?.vendors?.name}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Invoice Info</span>
                            <p className="font-medium">
                              {filteredGRNs.find(grn => grn.id === selectedGRN)?.notes || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material Code</TableHead>
                              <TableHead>Material Name</TableHead>
                              <TableHead>Expected/PO Quantity</TableHead>
                              <TableHead>Received Quantity</TableHead>
                              <TableHead>IQC Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredGRNs.find(grn => grn.id === selectedGRN)?.grn_items?.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                                <TableCell>{item.raw_materials?.name}</TableCell>
                                <TableCell>{item.po_quantity?.toLocaleString()}</TableCell>
                                <TableCell>{item.received_quantity?.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline"
                                    className={
                                      item.iqc_status === 'APPROVED' ? "bg-green-100 text-green-800 hover:bg-green-100" :
                                      item.iqc_status === 'REJECTED' ? "bg-red-100 text-red-800 hover:bg-red-100" :
                                      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                    }
                                  >
                                    {item.iqc_status || 'PENDING'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No GRNs found matching your search" : "No GRNs found"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Create your first GRN to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit GRN Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit GRN: {editingGRN?.grn_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingGRN?.grn_items && (
                <ScrollArea className="h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material Code</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Expected/PO Quantity</TableHead>
                        <TableHead>Received Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingGRN.grn_items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                          <TableCell>{item.raw_materials?.name}</TableCell>
                          <TableCell>{item.po_quantity}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={item.po_quantity}
                              value={editQuantities[item.id] || 0}
                              onChange={(e) => setEditQuantities(prev => ({
                                ...prev,
                                [item.id]: parseInt(e.target.value) || 0
                              }))}
                              className="w-24"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete GRN</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete GRN {grnToDelete?.grn_number}? This action cannot be undone.
                All related GRN items will also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteGRN}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default GRN;
