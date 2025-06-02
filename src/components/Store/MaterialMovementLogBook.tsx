
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { useMaterialMovements } from "@/hooks/useMaterialMovements";

const MaterialMovementLogBook = () => {
  const { data: movements = [], isLoading } = useMaterialMovements();

  const getMovementIcon = (type: string) => {
    return type === "RECEIVED" ? (
      <ArrowDownCircle className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowUpCircle className="h-4 w-4 text-blue-600" />
    );
  };

  const getMovementBadge = (type: string) => {
    return type === "RECEIVED" ? (
      <Badge variant="outline" className="text-green-600 border-green-600">
        Received
      </Badge>
    ) : (
      <Badge variant="outline" className="text-blue-600 border-blue-600">
        Issued
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Material Movement Log Book
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading material movements...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Material Movement Log Book ({movements.length} entries)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {movements.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Action Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Issued To</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    {format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-mono">
                    {movement.raw_materials?.material_code}
                  </TableCell>
                  <TableCell>{movement.raw_materials?.name}</TableCell>
                  <TableCell className="font-medium">{movement.quantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.movement_type)}
                      {getMovementBadge(movement.movement_type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{movement.reference_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {movement.reference_type.replace('_', ' ')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{movement.issued_to || '-'}</TableCell>
                  <TableCell>{movement.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No material movements recorded yet</p>
            <p className="text-sm mt-1">Material receipts and issuances will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialMovementLogBook;
