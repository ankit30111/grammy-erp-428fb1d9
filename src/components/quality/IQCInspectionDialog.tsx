
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileCheck, Upload } from "lucide-react";

interface IQCInspectionDialogProps {
  grn: any;
  isOpen: boolean;
  onClose: () => void;
}

const IQCInspectionDialog = ({ grn, isOpen, onClose }: IQCInspectionDialogProps) => {
  const [selectedItems, setSelectedItems] = useState<{[key: string]: {status: string, rejectedQty: number, remarks: string}}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateGRNItemsMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      const results = await Promise.all(
        updates.map(update => 
          supabase
            .from("grn_items")
            .update({
              iqc_status: update.status,
              rejected_quantity: update.rejectedQty,
              accepted_quantity: update.acceptedQty,
              iqc_approved_by: update.status === 'APPROVED' ? update.userId : null,
              iqc_approved_at: update.status === 'APPROVED' ? new Date().toISOString() : null,
              iqc_completed_by: update.userId,
              iqc_completed_at: new Date().toISOString()
            })
            .eq("id", update.itemId)
        )
      );
      
      const errors = results.filter(result => result.error);
      if (errors.length > 0) throw errors[0].error;
      
      // Update GRN status based on all items completion
      const allItemsCompleted = grn.grn_items.every((item: any) => 
        selectedItems[item.id] || item.iqc_status === 'APPROVED' || item.iqc_status === 'REJECTED'
      );
      
      if (allItemsCompleted) {
        await supabase
          .from("grn")
          .update({ status: "COMPLETED" })
          .eq("id", grn.id);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "IQC inspection completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["pending-grns"] });
      queryClient.invalidateQueries({ queryKey: ["completed-grns"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete IQC inspection",
        variant: "destructive",
      });
    },
  });

  const handleItemUpdate = (itemId: string, field: string, value: any) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    const updates = Object.entries(selectedItems).map(([itemId, data]) => {
      const item = grn.grn_items.find((i: any) => i.id === itemId);
      return {
        itemId,
        status: data.status,
        rejectedQty: data.rejectedQty || 0,
        acceptedQty: item.received_quantity - (data.rejectedQty || 0),
        userId: user.data.user.id,
        remarks: data.remarks
      };
    });

    if (updates.length === 0) {
      toast({
        title: "Error",
        description: "Please inspect at least one item",
        variant: "destructive",
      });
      return;
    }

    updateGRNItemsMutation.mutate(updates);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>IQC Inspection - {grn.grn_number}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Vendor:</strong> {grn.vendors?.name}</div>
            <div><strong>Received Date:</strong> {new Date(grn.received_date).toLocaleDateString()}</div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Items to Inspect</h3>
            {grn.grn_items?.map((item: any) => (
              <div key={item.id} className="border p-4 rounded space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><strong>Material:</strong> {item.raw_materials?.name}</div>
                  <div><strong>Code:</strong> {item.raw_materials?.material_code}</div>
                  <div><strong>Received Qty:</strong> {item.received_quantity}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>IQC Status</Label>
                    <Select 
                      value={selectedItems[item.id]?.status || ""} 
                      onValueChange={(value) => handleItemUpdate(item.id, "status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Rejected Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      max={item.received_quantity}
                      value={selectedItems[item.id]?.rejectedQty || 0}
                      onChange={(e) => handleItemUpdate(item.id, "rejectedQty", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div>
                    <Label>Accepted Quantity</Label>
                    <Input
                      type="number"
                      value={item.received_quantity - (selectedItems[item.id]?.rejectedQty || 0)}
                      disabled
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    value={selectedItems[item.id]?.remarks || ""}
                    onChange={(e) => handleItemUpdate(item.id, "remarks", e.target.value)}
                    placeholder="Enter inspection remarks..."
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={updateGRNItemsMutation.isPending}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {updateGRNItemsMutation.isPending ? "Completing..." : "Complete Inspection"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IQCInspectionDialog;
