
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface StoreDiscrepancyActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discrepancy: any;
  actionType: string;
}

const StoreDiscrepancyActionDialog = ({
  open,
  onOpenChange,
  discrepancy,
  actionType
}: StoreDiscrepancyActionDialogProps) => {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    remarks: '',
    expectedDate: '',
    creditAmount: '',
    creditReason: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      // Here you would implement the actual action logic
      console.log('Taking action:', actionType, actionData);
      
      // You could create a discrepancy_actions table to track these
      const { error } = await supabase
        .from('grn_items')
        .update({ 
          // You might want to add action tracking fields
        })
        .eq('id', discrepancy.id);
      
      if (error) throw error;
      return actionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-discrepancies'] });
      toast({
        title: "Action Completed",
        description: `${getActionTitle()} has been processed successfully.`,
      });
      onOpenChange(false);
      setFormData({
        subject: '',
        message: '',
        remarks: '',
        expectedDate: '',
        creditAmount: '',
        creditReason: ''
      });
    },
    onError: (error) => {
      console.error('Error taking action:', error);
      toast({
        title: "Error",
        description: "Failed to process the action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getActionTitle = () => {
    switch (actionType) {
      case 'notify-vendor':
        return 'Notify Vendor';
      case 'credit-note':
        return 'Issue Credit Note';
      case 'request-delivery':
        return 'Request Additional Delivery';
      case 'accept-delivery':
        return 'Accept Short Delivery';
      default:
        return 'Action';
    }
  };

  const getDiscrepancyAmount = () => {
    if (!discrepancy) return 0;
    return (discrepancy.received_quantity || 0) - (discrepancy.accepted_quantity || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actionMutation.mutate({
      discrepancyId: discrepancy?.id,
      actionType,
      formData,
      discrepancy
    });
  };

  if (!discrepancy) return null;

  const discrepancyAmount = getDiscrepancyAmount();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getActionTitle()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              <strong>Material:</strong> {discrepancy.raw_materials?.material_code} - {discrepancy.raw_materials?.name}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Vendor:</strong> {discrepancy.grn?.vendors?.name}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>GRN:</strong> {discrepancy.grn?.grn_number}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Discrepancy:</strong> 
              <span className={discrepancyAmount < 0 ? 'text-red-600' : 'text-orange-600'}>
                {discrepancyAmount > 0 ? `+${discrepancyAmount}` : discrepancyAmount} units
              </span>
            </div>
          </div>

          {(actionType === 'notify-vendor' || actionType === 'request-delivery') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Message to vendor"
                  required
                />
              </div>
              {actionType === 'request-delivery' && (
                <div className="space-y-2">
                  <Label htmlFor="expectedDate">Expected Delivery Date</Label>
                  <Input
                    id="expectedDate"
                    type="date"
                    value={formData.expectedDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDate: e.target.value }))}
                    required
                  />
                </div>
              )}
            </>
          )}

          {actionType === 'credit-note' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="creditAmount">Credit Amount</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  step="0.01"
                  value={formData.creditAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditAmount: e.target.value }))}
                  placeholder="Enter credit amount"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditReason">Credit Reason</Label>
                <Textarea
                  id="creditReason"
                  value={formData.creditReason}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditReason: e.target.value }))}
                  placeholder="Reason for credit note"
                  required
                />
              </div>
            </>
          )}

          {actionType === 'accept-delivery' && (
            <div className="space-y-2">
              <Label htmlFor="remarks">Acceptance Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Reason for accepting the discrepancy"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={actionMutation.isPending}>
              {actionMutation.isPending ? "Processing..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StoreDiscrepancyActionDialog;
