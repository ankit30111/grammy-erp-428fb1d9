
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, ChevronDown, Eye, Package } from "lucide-react";
import { ScheduledProduction as ScheduledProductionType, KitStatus, ProductionVoucherDetail, BOMItem } from "@/types/store";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";
import { bom } from "@/types/ppc";

interface EnhancedScheduledProductionProps {
  productions: ScheduledProductionType[];
  onStatusChange: (id: string, status: KitStatus) => void;
  onKitReceivedChange: (id: string, received: boolean) => void;
  onShortageReportChange: (id: string, hasShortage: boolean) => void;
}

export default function EnhancedScheduledProduction({ 
  productions, 
  onStatusChange,
  onKitReceivedChange,
  onShortageReportChange
}: EnhancedScheduledProductionProps) {
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  
  // Get status color class
  const getKitStatusClass = (status: KitStatus) => {
    switch (status) {
      case "KIT SENT":
        return "bg-blue-100 text-blue-800";
      case "KIT VERIFIED":
        return "bg-green-100 text-green-800";
      case "KIT SCHEDULED":
        return "bg-yellow-100 text-yellow-800";
      case "KIT SHORTAGE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMaterialStatusClass = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800";
      case "SHORTAGE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Generate voucher details for display
  const generateVoucherDetails = (production: ScheduledProductionType): ProductionVoucherDetail => {
    const productBom = bom[production.modelName as keyof typeof bom] || [];
    const bomItems: BOMItem[] = productBom.map(item => {
      const required = item.quantity * production.quantity;
      const available = Math.floor(Math.random() * required * 1.2); // Mock available quantity
      const shortage = Math.max(0, required - available);
      
      return {
        partCode: item.partCode,
        description: item.description,
        quantity: item.quantity,
        required,
        available,
        shortage,
        status: shortage > 0 ? "SHORTAGE" : "AVAILABLE"
      };
    });

    const hasShortage = bomItems.some(item => item.status === "SHORTAGE");
    const hasPartial = bomItems.some(item => item.shortage > 0 && item.available > 0);
    
    return {
      voucherNumber: production.voucherNumber,
      modelName: production.modelName,
      productionQuantity: production.quantity,
      bomItems,
      overallStatus: hasShortage ? "SHORTAGE" : hasPartial ? "PARTIAL" : "AVAILABLE"
    };
  };

  const selectedProduction = productions.find(p => p.voucherNumber === selectedVoucher);
  const voucherDetails = selectedProduction ? generateVoucherDetails(selectedProduction) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Production Vouchers & Kit Management</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Filter by Date
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher No</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Material Status</TableHead>
              <TableHead>Kit Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productions.map((production) => (
              <TableRow key={production.id}>
                <TableCell className="font-medium">{production.voucherNumber}</TableCell>
                <TableCell>{production.modelName}</TableCell>
                <TableCell>{format(new Date(production.scheduledDate), "PPP")}</TableCell>
                <TableCell>{production.quantity}</TableCell>
                <TableCell>
                  <span className={`${getMaterialStatusClass(production.materialStatus)} text-xs px-2 py-1 rounded-full font-medium`}>
                    {production.materialStatus}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className={`${getKitStatusClass(production.kitStatus)} text-xs px-2 py-1 h-auto rounded-full font-medium flex items-center`}>
                        {production.kitStatus}
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT SCHEDULED")}>
                        KIT SCHEDULED
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT VERIFIED")}>
                        KIT VERIFIED
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT SENT")}>
                        KIT SENT
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedVoucher(
                      selectedVoucher === production.voucherNumber ? null : production.voucherNumber
                    )}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {selectedVoucher === production.voucherNumber ? "Hide" : "View"} Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {voucherDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Voucher Details: {voucherDetails.voucherNumber} - {voucherDetails.modelName}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Production Quantity</p>
                <p className="text-2xl font-bold">{voucherDetails.productionQuantity}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Parts</p>
                <p className="text-2xl font-bold">{voucherDetails.bomItems.length}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Overall Status</p>
                <span className={`${getMaterialStatusClass(voucherDetails.overallStatus)} text-sm px-3 py-1 rounded-full font-medium`}>
                  {voucherDetails.overallStatus}
                </span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty per Unit</TableHead>
                  <TableHead>Total Required</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Shortage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voucherDetails.bomItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{item.partCode}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="font-medium">{item.required}</TableCell>
                    <TableCell className={item.shortage > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      {item.available}
                    </TableCell>
                    <TableCell className={item.shortage > 0 ? "text-red-600 font-medium" : ""}>
                      {item.shortage > 0 ? item.shortage : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status === "SHORTAGE" ? "rejected" : "approved"}>
                        {item.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
