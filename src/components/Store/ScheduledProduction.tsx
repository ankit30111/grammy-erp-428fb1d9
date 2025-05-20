
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Check, ChevronDown, FileCheck, X } from "lucide-react";
import { ScheduledProduction as ScheduledProductionType, KitStatus } from "@/types/store";
import { format } from "date-fns";

interface ScheduledProductionProps {
  productions: ScheduledProductionType[];
  onStatusChange: (id: string, status: KitStatus) => void;
  onKitReceivedChange: (id: string, received: boolean) => void;
  onShortageReportChange: (id: string, hasShortage: boolean) => void;
}

export default function ScheduledProduction({ 
  productions, 
  onStatusChange,
  onKitReceivedChange,
  onShortageReportChange
}: ScheduledProductionProps) {
  const [filteredProductions, setFilteredProductions] = useState<ScheduledProductionType[]>(productions);
  
  // Get status color class
  const getStatusClass = (status: KitStatus) => {
    switch (status) {
      case "KIT SENT":
        return "bg-blue-100 text-blue-800";
      case "KIT READY":
        return "bg-green-100 text-green-800";
      case "KIT SHORTAGE":
        return "bg-red-100 text-red-800";
      case "YET TO PLANNED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Scheduled Production</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Filter by Date
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher No</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Kit Status</TableHead>
            <TableHead>Kit Received</TableHead>
            <TableHead>Shortage Reported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProductions.map((production) => (
            <TableRow key={production.id}>
              <TableCell className="font-medium">{production.voucherNumber}</TableCell>
              <TableCell>{production.modelName}</TableCell>
              <TableCell>{format(new Date(production.scheduledDate), "PPP")}</TableCell>
              <TableCell>{production.quantity}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={`${getStatusClass(production.kitStatus)} text-xs px-2 py-1 h-auto rounded-full font-medium flex items-center`}>
                      {production.kitStatus}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT SENT")}>
                      KIT SENT
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT READY")}>
                      KIT READY
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(production.id, "KIT SHORTAGE")}>
                      KIT SHORTAGE
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(production.id, "YET TO PLANNED")}>
                      YET TO PLANNED
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              <TableCell>
                {production.kitStatus === "KIT SENT" ? (
                  <Button 
                    variant={production.kitReceived ? "outline" : "ghost"} 
                    size="sm" 
                    onClick={() => onKitReceivedChange(production.id, !production.kitReceived)}
                    className={production.kitReceived ? "bg-green-100 hover:bg-green-200 border-green-300 text-green-800" : ""}
                  >
                    {production.kitReceived ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Received
                      </>
                    ) : "Mark Received"}
                  </Button>
                ) : "-"}
              </TableCell>
              <TableCell>
                {production.kitStatus === "KIT SENT" ? (
                  <Button 
                    variant={production.shortageReported ? "outline" : "ghost"} 
                    size="sm" 
                    onClick={() => onShortageReportChange(production.id, !production.shortageReported)}
                    className={production.shortageReported ? "bg-red-100 hover:bg-red-200 border-red-300 text-red-800" : ""}
                  >
                    {production.shortageReported ? (
                      <>
                        <X className="mr-1 h-3 w-3" />
                        Shortage
                      </>
                    ) : "Report Shortage"}
                  </Button>
                ) : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
