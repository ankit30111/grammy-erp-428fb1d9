
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Upload, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const IQCRejections = () => {
  const [selectedRejection, setSelectedRejection] = useState<any>(null);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [vendorRemarks, setVendorRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rejections on hold
  const { data: rejectionsOnHold = [] } = useQuery({
    queryKey: ["iqc-rejections-on-hold"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iqc_rejections")
        .select(`
          *,
          vendors!inner(name, contact_person_name, contact_number, email),
          raw_materials!inner(material_code, name),
          grn!inner(grn_number)
        `)
        .eq("status", "PUT_ON_HOLD")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch materials sent back
  const { data: materialsSentBack = [] } = useQuery({
    queryKey: ["materials-sent-back"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iqc_rejections")
        .select(`
          *,
          vendors!inner(name),
          raw_materials!inner(material_code, name),
          grn!inner(grn_number)
        `)
        .eq("status", "SENT_BACK")
        .order("sent_back_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Send material back to vendor
  const sendBackMutation = useMutation({
    mutationFn: async (rejectionId: string) => {
      const { error } = await supabase
        .from("iqc_rejections")
        .update({
          status: "SENT_BACK",
          sent_back_at: new Date().toISOString(),
          sent_back_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", rejectionId);

      if (error) throw error;
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
    // This would typically send an email or notification to the vendor
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
                  {rejectionsOnHold.map((rejection) => (
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
              
              {rejectionsOnHold.length === 0 && (
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
                  {materialsSentBack.map((rejection) => (
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
              
              {materialsSentBack.length === 0 && (
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
