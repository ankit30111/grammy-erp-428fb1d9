
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, CheckCircle, AlertTriangle } from "lucide-react";
import { mockReceivedKits } from "@/types/production";
import { useState } from "react";

const KitVerification = () => {
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<Record<string, number>>({});

  const selectedKitDetails = mockReceivedKits.find(kit => kit.voucherNumber === selectedKit);

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'default';
      case 'DISCREPANCY': return 'destructive';
      case 'PENDING': return 'warning';
      default: return 'secondary';
    }
  };

  const handleVerificationChange = (partCode: string, value: string) => {
    setVerificationData(prev => ({
      ...prev,
      [partCode]: parseInt(value) || 0
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kit Verification ({mockReceivedKits.length} kits received)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead>Assigned Line</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockReceivedKits.map((kit) => (
                <TableRow key={kit.voucherNumber} className={selectedKit === kit.voucherNumber ? "bg-accent" : ""}>
                  <TableCell>
                    <input 
                      type="radio" 
                      name="kit" 
                      checked={selectedKit === kit.voucherNumber}
                      onChange={() => setSelectedKit(kit.voucherNumber)} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">{kit.voucherNumber}</TableCell>
                  <TableCell>{kit.modelName}</TableCell>
                  <TableCell>{new Date(kit.receivedDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getVerificationStatusColor(kit.verificationStatus) as any}>
                      {kit.verificationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{kit.assignedLine || 'Not assigned'}</TableCell>
                  <TableCell>
                    {kit.verificationStatus === 'PENDING' && (
                      <Button size="sm" onClick={() => setSelectedKit(kit.voucherNumber)}>
                        Verify Kit
                      </Button>
                    )}
                    {kit.verificationStatus === 'VERIFIED' && (
                      <Button size="sm" variant="outline">
                        View Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedKit && selectedKitDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Kit Verification - {selectedKit} ({selectedKitDetails.modelName})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Expected Qty</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedKitDetails.bomItems.map((item) => (
                  <TableRow key={item.partCode}>
                    <TableCell className="font-medium">{item.partCode}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.expectedQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={verificationData[item.partCode] || item.receivedQuantity || ''}
                        onChange={(e) => handleVerificationChange(item.partCode, e.target.value)}
                        placeholder="Enter qty"
                      />
                    </TableCell>
                    <TableCell>
                      {item.hasDiscrepancy ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Discrepancy
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <input 
                        type="checkbox" 
                        checked={item.verified} 
                        readOnly
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline">
                Report Discrepancy
              </Button>
              <Button>
                Complete Verification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KitVerification;
