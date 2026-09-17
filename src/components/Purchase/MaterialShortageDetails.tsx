import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShortageRow } from "@/hooks/useShortages";

interface MaterialShortageDetailsProps {
  shortage: ShortageRow | null;
  isOpen: boolean;
  onClose: () => void;
}

const MaterialShortageDetails = ({ shortage, isOpen, onClose }: MaterialShortageDetailsProps) => {
  if (!shortage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-sm bg-muted px-1 rounded mr-2">{shortage.part_code}</span>
            {shortage.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Required</div>
            <div className="text-lg font-semibold tabular-nums">{shortage.required.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Available</div>
            <div className="text-lg font-semibold tabular-nums">{shortage.available.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Hold</div>
            <div className="text-lg font-semibold tabular-nums">{shortage.hold.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Balance</div>
            <div className="text-lg font-semibold tabular-nums">
              <Badge variant={shortage.balance < 0 ? "destructive" : "secondary"}>
                {shortage.balance.toLocaleString()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Vendor: </span>
            {shortage.vendor_name || "Not set"}
          </div>
          <div>
            <span className="text-muted-foreground">Needed on: </span>
            {shortage.needed_on || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Unit: </span>
            {shortage.uom}
          </div>
          <div>
            <span className="text-muted-foreground">Status: </span>
            {shortage.purchase_order_item_id ? "Purchase order raised" : shortage.status}
          </div>
        </div>

        <div>
          <div className="font-medium mb-2">Where this demand comes from</div>
          {shortage.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No live demand — this line is kept because a purchase order already covers it.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finished Good</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Quantity Needed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortage.sources.map((source, index) => (
                  <TableRow key={`${source.label}-${index}`}>
                    <TableCell>{source.label}</TableCell>
                    <TableCell>{source.customer || "—"}</TableCell>
                    <TableCell>{source.needed_on || "—"}</TableCell>
                    <TableCell className="tabular-nums">{source.quantity.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialShortageDetails;
