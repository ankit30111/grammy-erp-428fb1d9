
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, CheckCircle, XCircle, Package, ArrowDown, TrendingDown } from "lucide-react";
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

  const formatNumber = (num: number) => num.toLocaleString();

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
            onKeyPress={(e) => e.key === 'Enter' && handleCheckMaterial()}
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
          <div className="space-y-6">
            {/* Material Info */}
            <div className="bg-gray-50 p-3 rounded">
              <div className="font-medium text-lg">{checkMaterial.data.materialCode}</div>
              <div className="text-sm text-muted-foreground">{checkMaterial.data.materialName}</div>
            </div>

            {/* Inventory Flow Calculation */}
            <div className="space-y-4">
              <div className="text-lg font-semibold text-center">Inventory Flow Analysis</div>
              
              {/* Starting Point - GRN Receipts */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Total GRN Receipts</span>
                </div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatNumber(checkMaterial.data.totalFromGRN)} units
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowDown className="h-6 w-6 text-gray-400" />
              </div>

              {/* Store Output Breakdown */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-800">Total Store Output</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-orange-600">Production Dispatches</div>
                    <div className="text-lg font-bold text-orange-800">
                      {formatNumber(checkMaterial.data.totalProductionDispatches)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-orange-600">Material Requests (Approved)</div>
                    <div className="text-lg font-bold text-orange-800">
                      {formatNumber(checkMaterial.data.totalMaterialRequests)}
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="text-sm text-orange-600">Total Output</div>
                  <div className="text-xl font-bold text-orange-800">
                    {formatNumber(checkMaterial.data.totalStoreOutput)} units
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="text-lg font-medium text-gray-600">=</div>
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Expected Inventory</div>
                  <div className="text-xl font-bold text-green-800">
                    {formatNumber(checkMaterial.data.expectedInventory)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    ({formatNumber(checkMaterial.data.totalFromGRN)} - {formatNumber(checkMaterial.data.totalStoreOutput)})
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-600 mb-1">Current Inventory</div>
                  <div className="text-xl font-bold text-purple-800">
                    {formatNumber(checkMaterial.data.currentInventory)}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    From inventory table
                  </div>
                </div>
              </div>

              {/* Final Discrepancy Result */}
              <div className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
                checkMaterial.data.discrepancy === 0 
                  ? "bg-green-50 border-green-300" 
                  : "bg-red-50 border-red-300"
              }`}>
                {checkMaterial.data.discrepancy === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <div className="flex-1">
                  <div className="font-bold text-lg">
                    {checkMaterial.data.discrepancy === 0 
                      ? "✅ Inventory is correct" 
                      : `❌ Discrepancy: ${checkMaterial.data.discrepancy > 0 ? '+' : ''}${formatNumber(checkMaterial.data.discrepancy)} units`
                    }
                  </div>
                  {checkMaterial.data.discrepancy !== 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {checkMaterial.data.discrepancy > 0 
                        ? "Inventory shows more than expected based on GRN receipts and store output"
                        : "Inventory shows less than expected based on GRN receipts and store output"
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Historical Data Sections */}
            {checkMaterial.data.grnEntries && checkMaterial.data.grnEntries.length > 0 && (
              <div>
                <div className="font-medium mb-2">GRN Receipt History ({checkMaterial.data.grnEntries.length} entries):</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {checkMaterial.data.grnEntries.map((entry, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="flex justify-between">
                        <span>GRN: {entry.grn.grn_number}</span>
                        <span className="font-mono">{formatNumber(entry.accepted_quantity)} units</span>
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
