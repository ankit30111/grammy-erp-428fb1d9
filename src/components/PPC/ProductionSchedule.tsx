
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check } from "lucide-react";
import { format } from "date-fns";
import { RawMaterialShortage, Production, PlannedDates } from "@/types/ppc";

interface ProductionScheduleProps {
  date: Date | undefined;
  getProductionsForDate: (specificDate?: string) => Production[];
  getMaterialStatusForDate: (specificDate?: string) => { 
    available: boolean; 
    shortages: RawMaterialShortage[] 
  } | null;
}

const ProductionSchedule = ({
  date,
  getProductionsForDate,
  getMaterialStatusForDate,
}: ProductionScheduleProps) => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {date ? `Production Schedule for ${format(date, 'PPP')}` : 'Select a date to view schedule'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Production Line</TableHead>
              <TableHead>Material Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getProductionsForDate().length > 0 ? (
              getProductionsForDate().map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium">{prod.id}</TableCell>
                  <TableCell>{prod.customer}</TableCell>
                  <TableCell>{prod.product}</TableCell>
                  <TableCell>{prod.quantity}</TableCell>
                  <TableCell>{prod.line}</TableCell>
                  <TableCell>
                    {getMaterialStatusForDate()?.available === false ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Shortage
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                        <Check className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  No production scheduled for this date
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {getProductionsForDate().length > 0 && getMaterialStatusForDate()?.shortages.length ? (
          <div className="mt-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="text-sm font-medium text-amber-800 mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Raw Material Shortages for This Production Schedule
            </h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-100/50">
                  <TableHead className="text-xs">Part Code</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Required</TableHead>
                  <TableHead className="text-xs">Available</TableHead>
                  <TableHead className="text-xs">Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getMaterialStatusForDate()?.shortages.map((shortage, index) => (
                  <TableRow key={index} className="bg-amber-50/50">
                    <TableCell className="text-xs font-mono">{shortage.partCode}</TableCell>
                    <TableCell className="text-xs">{shortage.description}</TableCell>
                    <TableCell className="text-xs">{shortage.required}</TableCell>
                    <TableCell className="text-xs">{shortage.available}</TableCell>
                    <TableCell className="text-xs font-medium text-amber-800">{shortage.shortage}</TableCell>
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
        ) : null}
      </CardContent>
    </Card>
  );
};

export default ProductionSchedule;
