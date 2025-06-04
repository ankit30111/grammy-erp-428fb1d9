
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
import { FileCheck, Upload, Eye, FileText } from "lucide-react";

interface IQCInspectionDialogProps {
  grn: any;
  isOpen: boolean;
  onClose: () => void;
}

interface InspectionItem {
  outcome: string;
  piecesChecked: number;
  acceptedQty: number;
  rejectedQty: number;
  reportUrl: string;
}

const IQCInspectionDialog = ({ grn, isOpen, onClose }: IQCInspectionDialogProps) => {
  const [selectedItems, setSelectedItems] = useState<{[key: string]: InspectionItem}>({});
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
      
      // Update GRN status
      await supabase
        .from("grn")
        .update({ status: "IQC_COMPLETED" })
        .eq("id", grn.id);

      // Handle rejections - log them for tracking
      const rejectedItems = updates.filter(update => update.rejectedQty > 0);
      if (rejectedItems.length > 0) {
        console.log("Rejected items to track:", rejectedItems);
        // This would insert into iqc_rejections table when it's available in types
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

  const handleItemUpdate = (itemId: string, field: keyof InspectionItem, value: any) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || {
        outcome: '',
        piecesChecked: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        reportUrl: ''
      };
      const updated = { ...current, [field]: value };
      
      // Auto-calculate quantities based on outcome
      if (field === 'outcome' || field === 'acceptedQty' || field === 'rejectedQty') {
        const item = grn.grn_items.find((i: any) => i.id === itemId);
        const totalQty = item?.received_quantity || 0;
        
        if (value === 'Pass') {
          updated.acceptedQty = totalQty;
          updated.rejectedQty = 0;
        } else if (value === 'Fail') {
          updated.acceptedQty = 0;
          updated.rejectedQty = totalQty;
        } else if (value === 'Segregate') {
          if (field === 'acceptedQty') {
            updated.rejectedQty = totalQty - (value || 0);
          } else if (field === 'rejectedQty') {
            updated.acceptedQty = totalQty - (value || 0);
          }
        }
      }
      
      return { ...prev, [itemId]: updated };
    });
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
      let status = 'APPROVED';
      
      if (data.outcome === 'Fail') {
        status = 'REJECTED';
      } else if (data.outcome === 'Segregate') {
        status = 'SEGREGATED';
      }
      
      return {
        itemId,
        status,
        acceptedQty: data.acceptedQty || 0,
        rejectedQty: data.rejectedQty || 0,
        totalQty: item.received_quantity,
        userId: user.data.user.id,
        raw_material_id: item.raw_material_id
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

  const viewSpecification = (materialId: string) => {
    // This would open specification sheet
    console.log("View specification for material:", materialId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>IQC Inspection - {grn.grn_number}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded">
            <div><strong>Vendor:</strong> {grn.vendors?.name}</div>
            <div><strong>PO Number:</strong> {grn.purchase_orders?.po_number}</div>
            <div><strong>Received Date:</strong> {new Date(grn.received_date).toLocaleDateString()}</div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Items for Inspection</h3>
            {grn.grn_items?.map((item: any) => (
              <div key={item.id} className="border p-6 rounded-lg space-y-4 bg-white">
                <div className="grid grid-cols-3 gap-4 text-sm font-medium bg-blue-50 p-3 rounded">
                  <div><strong>Part Name:</strong> {item.raw_materials?.name}</div>
                  <div><strong>Material Code:</strong> {item.raw_materials?.material_code}</div>
                  <div><strong>Quantity Received:</strong> {item.received_quantity}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pieces Checked</Label>
                    <Input
                      type="number"
                      min="1"
                      max={item.received_quantity}
                      value={selectedItems[item.id]?.piecesChecked || ""}
                      onChange={(e) => handleItemUpdate(item.id, "piecesChecked", parseInt(e.target.value) || 0)}
                      placeholder="Enter pieces checked"
                    />
                  </div>
                  
                  <div>
                    <Label>Inspection Outcome</Label>
                    <Select 
                      value={selectedItems[item.id]?.outcome || ""} 
                      onValueChange={(value) => handleItemUpdate(item.id, "outcome", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pass">Pass</SelectItem>
                        <SelectItem value="Fail">Fail</SelectItem>
                        <SelectItem value="Segregate">Segregate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedItems[item.id]?.outcome === 'Segregate' && (
                  <div className="grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded">
                    <div>
                      <Label>Accepted Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        max={item.received_quantity}
                        value={selectedItems[item.id]?.acceptedQty || 0}
                        onChange={(e) => handleItemUpdate(item.id, "acceptedQty", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Rejected Quantity (Auto-calculated)</Label>
                      <Input
                        type="number"
                        value={selectedItems[item.id]?.rejectedQty || 0}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Upload IQC Report</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          // Handle file upload logic here
                          console.log("File uploaded:", e.target.files?.[0]);
                        }}
                      />
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => viewSpecification(item.raw_material_id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      IQC Format
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => viewSpecification(item.raw_material_id)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Specification Sheet
                    </Button>
                  </div>
                </div>
                
                {(selectedItems[item.id]?.outcome === 'Pass' || 
                  selectedItems[item.id]?.outcome === 'Fail' || 
                  selectedItems[item.id]?.outcome === 'Segregate') && (
                  <div className="bg-green-50 p-4 rounded">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Final Accepted:</strong> {selectedItems[item.id]?.acceptedQty || 0}</div>
                      <div><strong>Final Rejected:</strong> {selectedItems[item.id]?.rejectedQty || 0}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={updateGRNItemsMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {updateGRNItemsMutation.isPending ? "Completing..." : "Complete IQC Inspection"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IQCInspectionDialog;
