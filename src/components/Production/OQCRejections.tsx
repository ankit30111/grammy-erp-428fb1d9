
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, AlertTriangle, Upload } from "lucide-react";
import { mockOQCRejections } from "@/types/production";
import { useState } from "react";

const OQCRejections = () => {
  const [selectedRejection, setSelectedRejection] = useState<string | null>(null);
  const [reworkNotes, setReworkNotes] = useState('');
  
  const selectedRejectionDetails = mockOQCRejections.find(r => r.id === selectedRejection);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED': return 'default';
      case 'CAPA_UPLOADED': return 'default';
      case 'REWORK_IN_PROGRESS': return 'warning';
      case 'PENDING_REWORK': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            OQC Rejections ({mockOQCRejections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Rejection ID</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead>Lot Number</TableHead>
                <TableHead>Rejection Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Rejected Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOQCRejections.map((rejection) => (
                <TableRow key={rejection.id} className={selectedRejection === rejection.id ? "bg-accent" : ""}>
                  <TableCell>
                    <input 
                      type="radio" 
                      name="rejection" 
                      checked={selectedRejection === rejection.id}
                      onChange={() => setSelectedRejection(rejection.id)} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">{rejection.id}</TableCell>
                  <TableCell>{rejection.voucherNumber}</TableCell>
                  <TableCell>{rejection.lotNumber}</TableCell>
                  <TableCell>{new Date(rejection.rejectionDate).toLocaleDateString()}</TableCell>
                  <TableCell>{rejection.rejectionReason}</TableCell>
                  <TableCell>{rejection.rejectedQuantity}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(rejection.status) as any}>
                      {rejection.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => setSelectedRejection(rejection.id)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRejection && selectedRejectionDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rejection Details - {selectedRejectionDetails.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Voucher Number</label>
                <p className="font-medium">{selectedRejectionDetails.voucherNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot Number</label>
                <p className="font-medium">{selectedRejectionDetails.lotNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rejection Date</label>
                <p className="font-medium">{new Date(selectedRejectionDetails.rejectionDate).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rejected Quantity</label>
                <p className="font-medium">{selectedRejectionDetails.rejectedQuantity} units</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Rejection Reason</label>
              <p className="font-medium">{selectedRejectionDetails.rejectionReason}</p>
            </div>
            
            {selectedRejectionDetails.capaDocument && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">CAPA Document</label>
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-blue-600 underline cursor-pointer">
                    {selectedRejectionDetails.capaDocument}
                  </span>
                </div>
              </div>
            )}
            
            {selectedRejectionDetails.reworkNotes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rework Notes</label>
                <p className="bg-gray-50 p-3 rounded-md">{selectedRejectionDetails.reworkNotes}</p>
              </div>
            )}
            
            {selectedRejectionDetails.status === 'PENDING_REWORK' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Rework Notes</label>
                  <Textarea
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    placeholder="Enter rework details and actions taken"
                    className="mt-1"
                  />
                </div>
                
                <div className="flex justify-end gap-4">
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload CAPA
                  </Button>
                  <Button>
                    Start Rework
                  </Button>
                </div>
              </div>
            )}
            
            {selectedRejectionDetails.status === 'REWORK_IN_PROGRESS' && (
              <div className="flex justify-end gap-4">
                <Button variant="outline">
                  Update Progress
                </Button>
                <Button>
                  Complete Rework
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OQCRejections;
