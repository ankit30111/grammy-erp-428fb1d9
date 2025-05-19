
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { RawMaterialShortage, Production, PlannedDates } from "@/types/ppc";

interface ProductionDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDateDetails: string | null;
  getProductionsForDate: (specificDate?: string) => Production[];
  getMaterialStatusForDate: (specificDate?: string) => { 
    available: boolean; 
    shortages: RawMaterialShortage[] 
  } | null;
}

const ProductionDetailsModal = ({
  isOpen,
  onOpenChange,
  selectedDateDetails,
  getProductionsForDate,
  getMaterialStatusForDate,
}: ProductionDetailsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {selectedDateDetails ? `Production Details: ${format(new Date(selectedDateDetails), 'PPP')}` : 'Production Details'}
          </DialogTitle>
          <DialogDescription>
            All scheduled production and material status for this date.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Scheduled Production</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Materials</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedDateDetails && getProductionsForDate(selectedDateDetails).length > 0 ? (
                getProductionsForDate(selectedDateDetails).map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell className="font-medium">{prod.product}</TableCell>
                    <TableCell>{prod.customer}</TableCell>
                    <TableCell>{prod.quantity}</TableCell>
                    <TableCell>{prod.line}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={getMaterialStatusForDate(selectedDateDetails)?.available === false ?
                          "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                          "bg-green-100 text-green-800 hover:bg-green-100"
                        }
                      >
                        {getMaterialStatusForDate(selectedDateDetails)?.available === false ?
                          "Shortage" : "Available"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No production scheduled</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {selectedDateDetails && getMaterialStatusForDate(selectedDateDetails)?.shortages.length ? (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Material Shortages</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Shortage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMaterialStatusForDate(selectedDateDetails)?.shortages.map((shortage, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{shortage.partCode}</TableCell>
                      <TableCell>{shortage.description}</TableCell>
                      <TableCell>{shortage.required}</TableCell>
                      <TableCell>{shortage.available}</TableCell>
                      <TableCell className="text-red-600 font-medium">{shortage.shortage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm">
                  View Kit Composition
                </Button>
              </div>
            </div>
          ) : selectedDateDetails && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 flex items-center">
                <Check className="mr-2 h-4 w-4" />
                All materials are available for production on this date
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionDetailsModal;
