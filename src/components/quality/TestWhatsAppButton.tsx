import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, TestTube, Phone } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TestWhatsAppButton = () => {
  const { toast } = useToast();
  const [testNumber, setTestNumber] = useState("919810867133");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Test with default GRN item
  const testWhatsAppNotification = useMutation({
    mutationFn: async () => {
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

  // Test with custom number
  const testCustomNumber = useMutation({
    mutationFn: async () => {
      console.log('Testing WhatsApp API with custom number:', testNumber);
      
      const { data, error } = await supabase.functions.invoke('test-whatsapp-direct', {
        body: { 
          phone_number: testNumber,
          message: `🧪 *WhatsApp API Test*\n\nThis is a test message to verify WhatsApp Business API connectivity.\n\nTimestamp: ${new Date().toLocaleString('en-IN')}\n\nIf you receive this message, the API is working correctly!`
        }
      });
      
      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }
      
      console.log('Custom test response:', data);
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Custom Test Successful",
          description: `Test message sent to ${testNumber}`,
        });
      } else {
        toast({
          title: "Custom Test Failed",
          description: data.message || "Failed to send test message",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Custom test error:', error);
      toast({
        title: "Custom Test Failed",
        description: error.message || "Failed to send test message",
        variant: "destructive",
      });
    },
  });

  // Check delivery status
  const checkDeliveryStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('Recent WhatsApp notifications:', data);
      toast({
        title: "Delivery Status Check",
        description: `Found ${data.length} recent notifications. Check console for details.`,
      });
    },
    onError: (error: any) => {
      console.error('Delivery status check error:', error);
      toast({
        title: "Status Check Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (showAdvanced) {
    return (
      <Card className="w-80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            WhatsApp API Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-number" className="text-xs">Test Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="test-number"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="919810867133"
                className="text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={testCustomNumber.isPending}
                onClick={() => testCustomNumber.mutate()}
              >
                {testCustomNumber.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Phone className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={testWhatsAppNotification.isPending}
              onClick={() => testWhatsAppNotification.mutate()}
              className="flex-1"
            >
              {testWhatsAppNotification.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
              IQC Test
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={checkDeliveryStatus.isPending}
              onClick={() => checkDeliveryStatus.mutate()}
            >
              Status
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(false)}
            className="w-full text-xs"
          >
            Simple View
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={testWhatsAppNotification.isPending}
      onClick={() => setShowAdvanced(true)}
      className="gap-2"
    >
      <TestTube className="h-4 w-4" />
      Test WhatsApp
    </Button>
  );
};

export default TestWhatsAppButton;