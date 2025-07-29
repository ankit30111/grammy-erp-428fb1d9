import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ManualWhatsAppButtonProps {
  grnItemId: string;
  vendorName: string;
  disabled?: boolean;
}

const ManualWhatsAppButton = ({ grnItemId, vendorName, disabled }: ManualWhatsAppButtonProps) => {
  const { toast } = useToast();
  
  const sendWhatsAppNotification = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-iqc-notification', {
        body: { grn_item_id: grnItemId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "WhatsApp Sent",
          description: `Notification sent to ${vendorName} successfully`,
        });
      } else {
        toast({
          title: "Notification Failed",
          description: data.message || "Failed to send WhatsApp notification",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('WhatsApp notification error:', error);
      toast({
        title: "Notification Failed",
        description: error.message || "Failed to send WhatsApp notification",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || sendWhatsAppNotification.isPending}
      onClick={() => sendWhatsAppNotification.mutate()}
      className="gap-1"
    >
      {sendWhatsAppNotification.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MessageSquare className="h-3 w-3" />
      )}
      Send WhatsApp
    </Button>
  );
};

export default ManualWhatsAppButton;