
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialRequest, ScheduledProduction } from "@/types/store";
import { AlertTriangle, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface ProductionFeedbackProps {
  materialRequests: MaterialRequest[];
  productions: ScheduledProduction[];
  onApproveMaterialRequest: (id: string) => void;
  onRejectMaterialRequest: (id: string) => void;
}

export default function ProductionFeedback({
  materialRequests,
  productions,
  onApproveMaterialRequest,
  onRejectMaterialRequest
}: ProductionFeedbackProps) {
  const [selectedVoucher, setSelectedVoucher] = useState<string>("");
  
  // Filter material requests by voucher number if one is selected
  const filteredRequests = selectedVoucher 
    ? materialRequests.filter(request => request.voucherNumber === selectedVoucher)
    : materialRequests;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Production Material Requests</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Filter by Voucher:</span>
          <Select value={selectedVoucher} onValueChange={setSelectedVoucher}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select voucher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vouchers</SelectItem>
              {productions
                .filter(prod => prod.kitStatus === "KIT SENT")
                .map(prod => (
                  <SelectItem key={prod.voucherNumber} value={prod.voucherNumber}>
                    {prod.voucherNumber}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Voucher No</TableHead>
              <TableHead>Part Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Original Qty</TableHead>
              <TableHead>Additional Qty</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{format(new Date(request.date), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="font-medium">{request.voucherNumber}</TableCell>
                  <TableCell className="font-mono">{request.partCode}</TableCell>
                  <TableCell>{request.description}</TableCell>
                  <TableCell>{request.originalQuantity}</TableCell>
                  <TableCell>{request.additionalQuantity}</TableCell>
                  <TableCell>
                    <span className="text-sm">{request.reason}</span>
                  </TableCell>
                  <TableCell>
                    {request.status === "PENDING" ? (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        Pending
                      </span>
                    ) : request.status === "APPROVED" ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Approved
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                        Rejected
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {request.status === "PENDING" && (
                      <div className="flex space-x-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-green-100 hover:bg-green-200 border-green-300 text-green-800"
                          onClick={() => onApproveMaterialRequest(request.id)}
                        >
                          Approve
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-red-100 hover:bg-red-200 border-red-300 text-red-800"
                          onClick={() => onRejectMaterialRequest(request.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-32 text-muted-foreground">
                  No material requests found
                  {selectedVoucher && " for the selected voucher"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
