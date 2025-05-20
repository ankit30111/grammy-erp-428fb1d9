
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Package, Search, Filter } from "lucide-react";
import { mockScheduledProductions } from "@/types/store";
import { format } from "date-fns";
import { bom } from "@/types/ppc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";

export default function KitManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  
  const productionWithSelectedVoucher = selectedVoucher 
    ? mockScheduledProductions.find(p => p.voucherNumber === selectedVoucher)
    : null;
  
  const bomItems = productionWithSelectedVoucher 
    ? bom[productionWithSelectedVoucher.modelName as keyof typeof bom] || []
    : [];

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center space-x-4 mb-6">
        <Package className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Kit Management</h1>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scheduled Productions for Kitting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vouchers or models..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockScheduledProductions
                .filter(prod => 
                  prod.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  prod.modelName.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((production) => (
                  <TableRow 
                    key={production.id} 
                    className={selectedVoucher === production.voucherNumber ? "bg-primary/5" : ""}
                  >
                    <TableCell className="font-medium">{production.voucherNumber}</TableCell>
                    <TableCell>{production.modelName}</TableCell>
                    <TableCell>{format(new Date(production.scheduledDate), "PPP")}</TableCell>
                    <TableCell>{production.quantity}</TableCell>
                    <TableCell>
                      <StatusBadge 
                        status={
                          production.kitStatus === "KIT READY" ? "approved" :
                          production.kitStatus === "KIT SHORTAGE" ? "rejected" :
                          production.kitStatus === "KIT SENT" ? "inProgress" : "pending"
                        }
                      >
                        {production.kitStatus}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedVoucher(
                          selectedVoucher === production.voucherNumber ? null : production.voucherNumber
                        )}
                      >
                        {selectedVoucher === production.voucherNumber ? "Hide Details" : "View Kit"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {selectedVoucher && productionWithSelectedVoucher && (
        <Card>
          <CardHeader>
            <CardTitle>
              Kit Details for {productionWithSelectedVoucher.voucherNumber} - {productionWithSelectedVoucher.modelName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity per Unit</TableHead>
                  <TableHead>Total Required</TableHead>
                  <TableHead>Available in Store</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomItems.map((item, index) => {
                  const totalRequired = item.quantity * productionWithSelectedVoucher!.quantity;
                  const available = Math.random() > 0.3 ? totalRequired : Math.floor(totalRequired * 0.8);
                  const isShortage = available < totalRequired;
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{item.partCode}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="font-medium">{totalRequired}</TableCell>
                      <TableCell className={isShortage ? "text-red-600 font-medium" : ""}>
                        {available}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={isShortage ? "rejected" : "approved"}>
                          {isShortage ? "Shortage" : "Available"}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            <div className="flex justify-end mt-6 space-x-2">
              <Button variant="outline">Print Kit List</Button>
              <Button>Generate Kit Voucher</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
