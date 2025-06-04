
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const IQCRejections = () => {
  const [selectedRejection, setSelectedRejection] = useState<any>(null);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [vendorRemarks, setVendorRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rejections on hold using existing grn_items table
  const { data: rejectionsOnHold = [] } = useQuery({
    queryKey: ["iqc-rejections-on-hold"],
    queryFn: async () => {
      console.log("Fetching rejected GRN items from grn_items table");
      const { data, error } = await supabase
        .from("grn_items")
        .select(`
          *,
          grn!inner(
            id, grn_number, vendor_id,
            purchase_orders!inner(po_number),
            vendors!inner(name, contact_person_name, contact_number, email)
          ),
          raw_materials!inner(material_code, name)
        `)
        .eq("iqc_status", "REJECTED")
        .order("iqc_completed_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching rejected GRN items:", error);
        throw error;
      }
      
      console.log("Fetched rejected GRN items:", data);
      return data?.map(item => ({
        id: item.id,
        po_number: item.grn?.purchase_orders?.po_number,
        grn: { grn_number: item.grn?.grn_number },
        vendors: item.grn?.vendors,
        raw_materials: item.raw_materials,
        total_quantity: item.received_quantity,
        accepted_quantity: item.accepted_quantity || 0,
        rejected_quantity: item.rejected_quantity || 0
      })) || [];
    },
  });

  // Fetch materials sent back (placeholder for now)
  const { data: materialsSentBack = [] } = useQuery({
    queryKey: ["materials-sent-back"],
    queryFn: async () => {
      console.log("Fetching materials sent back - using placeholder data");
      // Placeholder implementation until we have the proper table structure
      return [];
    },
  });

  // Send material back to vendor
  const sendBackMutation = useMutation({
    mutationFn: async (rejectionId: string) => {
      console.log("Sending material back to vendor:", rejectionId);
      // This would update the status when the proper table exists
      // For now, just simulate the action
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Material marked as sent back to vendor",
      });
      queryClient.invalidateQueries({ queryKey: ["iqc-rejections-on-hold"] });
      queryClient.invalidateQueries({ queryKey: ["materials-sent-back"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to send material back",
        variant: "destructive",
      });
    },
  });

  const handleNotifyVendor = (rejection: any) => {
    setSelectedRejection(rejection);
    setShowVendorDialog(true);
  };

  const handleVendorNotification = () => {
    console.log("Notifying vendor:", selectedRejection?.vendors?.email);
    console.log("Remarks:", vendorRemarks);
    
    toast({
      title: "Vendor Notified",
      description: `Notification sent to ${selectedRejection?.vendors?.name}`,
    });
    
    setShowVendorDialog(false);
    setVendorRemarks("");
    setSelectedRejection(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>IQC Rejections Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="on-hold">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="on-hold">Material on Hold</TabsTrigger>
              <TabsTrigger value="sent-back">Material Sent Back</TabsTrigger>
            </TabsList>
            
            <TabsContent value="on-hold" className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium">
                  🔴 Status: Put on Hold — Awaiting Vendor CAPA
                </p>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>GRN Number</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Total Qty</TableHead>
                    <TableHead>Accepted Qty</TableHead>
                    <TableHead>Rejected Qty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(rejectionsOnHold) && rejectionsOnHold.map((rejection) => (
                    <TableRow key={rejection.id}>
                      <TableCell className="font-medium">{rejection.po_number}</TableCell>
                      <TableCell>{rejection.grn?.grn_number}</TableCell>
                      <TableCell>{rejection.vendors?.name}</TableCell>
                      <TableCell className="font-mono">{rejection.raw_materials?.material_code}</TableCell>
                      <TableCell>{rejection.total_quantity}</TableCell>
                      <TableCell className="text-green-600">{rejection.accepted_quantity}</TableCell>
                      <TableCell className="text-red-600">{rejection.rejected_quantity}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleNotifyVendor(rejection)}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Notify Vendor
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => sendBackMutation.mutate(rejection.id)}
                            disabled={sendBackMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send Back
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {!Array.isArray(rejectionsOnHold) || rejectionsOnHold.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No materials on hold
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent-back" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>GRN Number</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Rejected Qty</TableHead>
                    <TableHead>Sent Back Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(materialsSentBack) && materialsSentBack.map((rejection: any) => (
                    <TableRow key={rejection.id}>
                      <TableCell className="font-medium">{rejection.po_number}</TableCell>
                      <TableCell>{rejection.grn?.grn_number}</TableCell>
                      <TableCell>{rejection.vendors?.name}</TableCell>
                      <TableCell className="font-mono">{rejection.raw_materials?.material_code}</TableCell>
                      <TableCell className="text-red-600">{rejection.rejected_quantity}</TableCell>
                      <TableCell>{new Date(rejection.sent_back_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Returned to Vendor</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {!Array.isArray(materialsSentBack) || materialsSentBack.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No materials sent back to vendors
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Vendor Notification Dialog */}
      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notify Vendor - Material Rejection</DialogTitle>
          </DialogHeader>
          
          {selectedRejection && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded">
                <div><strong>Vendor:</strong> {selectedRejection.vendors?.name}</div>
                <div><strong>Contact Person:</strong> {selectedRejection.vendors?.contact_person_name}</div>
                <div><strong>Phone:</strong> {selectedRejection.vendors?.contact_number}</div>
                <div><strong>Email:</strong> {selectedRejection.vendors?.email}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Material:</strong> {selectedRejection.raw_materials?.material_code}</div>
                <div><strong>Rejected Qty:</strong> {selectedRejection.rejected_quantity}</div>
              </div>
              
              <div>
                <Label>Upload Vendor CAPA</Label>
                <Input type="file" accept=".pdf,.doc,.docx" />
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={vendorRemarks}
                  onChange={(e) => setVendorRemarks(e.target.value)}
                  placeholder="Enter remarks for vendor notification..."
                  rows={4}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowVendorDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleVendorNotification}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IQCRejections;
