
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, FileCheck, Search } from "lucide-react";
import { mockGRNs, GRNItem } from "@/types/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GRNReceiving from "@/components/Store/GRNReceiving";
import { useToast } from "@/hooks/use-toast";

export default function GRNReceivingPage() {
  const { toast } = useToast();
  const [grns, setGRNs] = useState<GRNItem[]>(mockGRNs);
  
  // Handler for receiving GRN
  const handleReceiveGRN = (id: string, quantity: number) => {
    const grn = grns.find(g => g.id === id);
    
    if (!grn) return;
    
    const hasDiscrepancy = quantity < grn.expectedQuantity;
    
    setGRNs(prev =>
      prev.map(g =>
        g.id === id
          ? {
              ...g,
              receivedQuantity: quantity,
              hasDiscrepancy,
              status: hasDiscrepancy ? "DISCREPANCY" : "RECEIVED"
            }
          : g
      )
    );
    
    if (hasDiscrepancy) {
      toast({
        title: "Discrepancy Detected",
        description: `Received quantity (${quantity}) is less than expected quantity (${grn.expectedQuantity})`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "GRN Received Successfully",
        description: `${quantity} units of ${grn.partCode} have been received into store`,
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center space-x-4 mb-6">
        <FileCheck className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">GRN Receiving</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>IQC-Passed GRN Receiving</CardTitle>
        </CardHeader>
        <CardContent>
          <GRNReceiving
            grns={grns}
            onReceiveGRN={handleReceiveGRN}
          />
        </CardContent>
      </Card>
    </div>
  );
}
