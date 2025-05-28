
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceivedKit, BOMReceivedItem, mockReceivedKits } from "@/types/production";
import { CheckCircle, AlertTriangle, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function KitVerification() {
  const { toast } = useToast();
  const [receivedKits, setReceivedKits] = useState<ReceivedKit[]>(mockReceivedKits);
  const [selectedKit, setSelectedKit] = useState<string>("");

  const handleQuantityChange = (kitIndex: number, itemIndex: number, quantity: number) => {
    setReceivedKits(prev => 
      prev.map((kit, kIndex) => 
        kIndex === kitIndex 
          ? {
              ...kit,
              bomItems: kit.bomItems.map((item, iIndex) => 
                iIndex === itemIndex 
                  ? { 
                      ...item, 
                      receivedQuantity: quantity,
                      hasDiscrepancy: quantity !== item.expectedQuantity 
                    }
                  : item
              )
            }
          : kit
      )
    );
  };

  const handleVerifyItem = (kitIndex: number, itemIndex: number) => {
    setReceivedKits(prev => 
      prev.map((kit, kIndex) => 
        kIndex === kitIndex 
          ? {
              ...kit,
              bomItems: kit.bomItems.map((item, iIndex) => 
                iIndex === itemIndex 
                  ? { ...item, verified: true }
                  : item
              )
            }
          : kit
      )
    );

    toast({
      title: "Item Verified",
      description: "BOM item has been verified successfully",
    });
  };

  const handleVerifyKit = (kitIndex: number) => {
    const kit = receivedKits[kitIndex];
    const allItemsVerified = kit.bomItems.every(item => item.verified);
    const hasDiscrepancies = kit.bomItems.some(item => item.hasDiscrepancy);

    if (!allItemsVerified) {
      toast({
        title: "Verification Incomplete",
        description: "Please verify all BOM items before completing kit verification",
        variant: "destructive"
      });
      return;
    }

    setReceivedKits(prev => 
      prev.map((k, kIndex) => 
        kIndex === kitIndex 
          ? { 
              ...k, 
              verificationStatus: hasDiscrepancies ? "DISCREPANCY" : "VERIFIED" 
            }
          : k
      )
    );

    toast({
      title: "Kit Verification Complete",
      description: hasDiscrepancies 
        ? "Kit verified with discrepancies noted" 
        : "Kit verified successfully",
      variant: hasDiscrepancies ? "destructive" : "default"
    });
  };

  const getVerificationStatusBadge = (status: ReceivedKit["verificationStatus"]) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case "DISCREPANCY":
        return <Badge className="bg-red-100 text-red-800">Discrepancy</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const selectedKitData = selectedKit ? receivedKits.find(kit => kit.voucherNumber === selectedKit) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Kit Verification</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Select Kit:</span>
          <Select value={selectedKit} onValueChange={setSelectedKit}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select voucher" />
            </SelectTrigger>
            <SelectContent>
              {receivedKits.map(kit => (
                <SelectItem key={kit.voucherNumber} value={kit.voucherNumber}>
                  {kit.voucherNumber} - {kit.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kit Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {receivedKits.map((kit, kitIndex) => (
          <Card key={kit.voucherNumber} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{kit.voucherNumber}</CardTitle>
                {getVerificationStatusBadge(kit.verificationStatus)}
              </div>
              <CardDescription>{kit.modelName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Package className="h-4 w-4 mr-1" />
                  <span>Received: {kit.receivedDate}</span>
                </div>
                {kit.assignedLine && (
                  <div className="text-sm text-gray-600">
                    <span>Assigned: {kit.assignedLine}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span>Items: {kit.bomItems.filter(item => item.verified).length}/{kit.bomItems.length} verified</span>
                </div>
                {kit.verificationStatus === "PENDING" && (
                  <Button 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => setSelectedKit(kit.voucherNumber)}
                  >
                    Verify Kit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Verification Table */}
      {selectedKitData && (
        <Card>
          <CardHeader>
            <CardTitle>Kit Details - {selectedKitData.voucherNumber}</CardTitle>
            <CardDescription>
              Verify received quantities against BOM requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Expected Qty</TableHead>
                    <TableHead>Received Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedKitData.bomItems.map((item, itemIndex) => (
                    <TableRow key={item.partCode}>
                      <TableCell className="font-mono">{item.partCode}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.expectedQuantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.receivedQuantity || ""}
                          onChange={(e) => {
                            const kitIndex = receivedKits.findIndex(k => k.voucherNumber === selectedKitData.voucherNumber);
                            handleQuantityChange(kitIndex, itemIndex, parseInt(e.target.value) || 0);
                          }}
                          className="w-20"
                          placeholder="0"
                          disabled={item.verified}
                        />
                      </TableCell>
                      <TableCell>
                        {item.verified ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : item.hasDiscrepancy ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Discrepancy
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!item.verified && item.receivedQuantity !== undefined && (
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const kitIndex = receivedKits.findIndex(k => k.voucherNumber === selectedKitData.voucherNumber);
                              handleVerifyItem(kitIndex, itemIndex);
                            }}
                          >
                            Verify
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {selectedKitData.verificationStatus === "PENDING" && (
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={() => {
                    const kitIndex = receivedKits.findIndex(k => k.voucherNumber === selectedKitData.voucherNumber);
                    handleVerifyKit(kitIndex);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Complete Kit Verification
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
