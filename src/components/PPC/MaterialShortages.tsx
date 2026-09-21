import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { MaterialShortage } from "@/utils/materialShortageCalculator";

interface MaterialShortagesProps {
  shortages: MaterialShortage[];
  onCreatePO?: (shortage: MaterialShortage) => void;
}

const MaterialShortages = ({ shortages, onCreatePO }: MaterialShortagesProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Material Shortages
          <Badge variant={shortages.some((s) => s.shortage > 0) ? "destructive" : "secondary"}>
            {shortages.filter((s) => s.shortage > 0).length} short
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S.No.</TableHead>
              <TableHead>Part Code</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Hold</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Needed On</TableHead>
              {onCreatePO && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shortages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onCreatePO ? 10 : 9} className="text-center py-6 text-muted-foreground">
                  No material requirements yet.
                </TableCell>
              </TableRow>
            ) : (
              shortages.map((shortage, index) => (
                <TableRow key={shortage.part_id}>
                  <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                  <TableCell className="font-mono font-medium">{shortage.part_code}</TableCell>
                  <TableCell>{shortage.name}</TableCell>
                  <TableCell>{shortage.vendor_name || "—"}</TableCell>
                  <TableCell className="tabular-nums">{shortage.required.toLocaleString()}</TableCell>
                  <TableCell className="tabular-nums">{shortage.available.toLocaleString()}</TableCell>
                  <TableCell className="tabular-nums">{shortage.hold.toLocaleString()}</TableCell>
                  <TableCell className="tabular-nums">
                    <Badge variant={shortage.balance < 0 ? "destructive" : "secondary"}>
                      {shortage.balance.toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell>{shortage.needed_on || "—"}</TableCell>
                  {onCreatePO && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onCreatePO(shortage)}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Raise PO
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MaterialShortages;
