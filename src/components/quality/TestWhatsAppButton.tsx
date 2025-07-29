import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TestWhatsAppButton = () => {
  const { toast } = useToast();
  
  const testWhatsAppNotification = useMutation({
    mutationFn: async () => {
      // Use the existing rejected GRN item for testing
      const testGrnItemId = "444eb169-ce70-4d34-8726-7fa8b97ea285";
      
      console.log('Testing WhatsApp notification for GRN item:', testGrnItemId);
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-iqc-notification', {
        body: { grn_item_id: testGrnItemId }
      });
      
      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }
      
      console.log('Function response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('WhatsApp test response:', data);
      if (data.success) {
        toast({
          title: "WhatsApp Test Successful",
          description: `Notification sent to ${data.vendor} at ${data.whatsapp_number}`,
        });
      } else {
        toast({
          title: "WhatsApp Test Failed",
          description: data.message || "Failed to send WhatsApp notification",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('WhatsApp test error:', error);
      toast({
        title: "WhatsApp Test Failed",
        description: error.message || "Failed to send WhatsApp test notification",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={testWhatsAppNotification.isPending}
      onClick={() => testWhatsAppNotification.mutate()}
      className="gap-2"
    >
      {testWhatsAppNotification.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      Test WhatsApp API
    </Button>
  );
};

export default TestWhatsAppButton;