
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, CheckCircle, XCircle } from "lucide-react";
import { useCheckMaterialInventory } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";

const InventoryDiagnostics = () => {
  const [materialCode, setMaterialCode] = useState("");
  const checkMaterial = useCheckMaterialInventory();
  const { toast } = useToast();

  const handleCheckMaterial = () => {
    if (!materialCode.trim()) {
      toast({
        title: "Material Code Required",
        description: "Please enter a material code to check",
        variant: "destructive"
      });
      return;
    }

    checkMaterial.mutate(materialCode.trim().toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Inventory Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter material code (e.g., E-001)"
            value={materialCode}
            onChange={(e) => setMaterialCode(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleCheckMaterial}
            disabled={checkMaterial.isPending}
          >
            <Search className="h-4 w-4 mr-2" />
            {checkMaterial.isPending ? "Checking..." : "Check"}
          </Button>
        </div>

        {checkMaterial.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Total from GRN Receipts</div>
                <div className="text-xl font-bold text-blue-800">
                  {checkMaterial.data.totalFromGRN}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-sm text-green-600">Current Inventory</div>
                <div className="text-xl font-bold text-green-800">
                  {checkMaterial.data.currentInventory}
                </div>
              </div>
            </div>

            <div className={`p-3 rounded flex items-center gap-2 ${
              checkMaterial.data.discrepancy === 0 
                ? "bg-green-50 border border-green-200" 
                : "bg-red-50 border border-red-200"
            }`}>
              {checkMaterial.data.discrepancy === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">
                  {checkMaterial.data.discrepancy === 0 
                    ? "✅ Inventory is correct" 
                    : `❌ Discrepancy detected: ${checkMaterial.data.discrepancy > 0 ? '+' : ''}${checkMaterial.data.discrepancy}`
                  }
                </div>
                {checkMaterial.data.discrepancy !== 0 && (
                  <div className="text-sm text-muted-foreground">
                    Inventory shows {Math.abs(checkMaterial.data.discrepancy)} more than it should based on GRN receipts
                  </div>
                )}
              </div>
            </div>

            {checkMaterial.data.grnEntries && checkMaterial.data.grnEntries.length > 0 && (
              <div>
                <div className="font-medium mb-2">GRN Receipt History:</div>
                <div className="space-y-2">
                  {checkMaterial.data.grnEntries.map((entry, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="flex justify-between">
                        <span>GRN: {entry.grn.grn_number}</span>
                        <span className="font-mono">{entry.accepted_quantity} units</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Received: {new Date(entry.grn.received_date).toLocaleDateString()}
                        {entry.store_confirmed_at && (
                          <> • Confirmed: {new Date(entry.store_confirmed_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {checkMaterial.error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded">
            <div className="text-red-800 font-medium">Error checking material</div>
            <div className="text-red-600 text-sm">
              {checkMaterial.error instanceof Error ? checkMaterial.error.message : "Unknown error"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryDiagnostics;
