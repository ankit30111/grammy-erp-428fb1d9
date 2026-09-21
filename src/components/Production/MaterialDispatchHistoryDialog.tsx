import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Inbox } from "lucide-react";
import { format } from "date-fns";
import { KIT_STATUS, KIT_STATUS_LABELS, kitStatusVariant } from "@/constants/kitStatus";

/**
 * Every issue of one material against one production voucher, and what production
 * counted for each.
 *
 * This dialog used to carry a second "Verify" button that wrote
 * kit_items.verified_by_production (a column that does not exist) and then posted
 * a stock movement straight from the browser. That meant production could correct
 * the main store by typing a number, with no store decision in between - the exact
 * thing the kit feedback loop exists to prevent. It also read received_quantity as
 * "quantity sent", so every difference it displayed was wrong.
 *
 * It is now what its name says: history. Counting happens once, in Production >
 * Kit Receipt, and any difference goes to the store to accept or reject.
 */

interface MaterialDispatchHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrderId: string;
  rawMaterialId: string;
  materialCode: string;
  materialName: string;
  requiredQuantity: number;
}

const MaterialDispatchHistoryDialog = ({
  isOpen,
  onClose,
  productionOrderId,
  rawMaterialId,
  materialCode,
  materialName,
  requiredQuantity,
}: MaterialDispatchHistoryDialogProps) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["material-dispatch-history", productionOrderId, rawMaterialId],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          id,
          issued_quantity,
          received_quantity,
          created_at,
          kit_preparation!inner (
            kit_number,
            status,
            production_order_id,
            sent_at
          )
        `)
        .eq("kit_preparation.production_order_id", productionOrderId)
        .eq("part_id", rawMaterialId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalIssued = history.reduce((s: number, r: any) => s + Number(r.issued_quantity ?? 0), 0);
  const totalCounted = history.reduce(
    (s: number, r: any) => s + Number(r.received_quantity ?? 0), 0
  );
  const outstanding = Math.max(0, requiredQuantity - totalCounted);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="font-mono">{materialCode}</span>
            <span className="text-muted-foreground font-normal">{materialName}</span>
          </DialogTitle>
          <DialogDescription>
            Every issue of this material against this voucher. To record what
            production actually received, use Production &gt; Kit Receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4 rounded-lg border p-4">
            <div>
              <span className="text-sm text-muted-foreground">Required</span>
              <p className="text-lg font-semibold font-mono">
                {requiredQuantity.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Issued by store</span>
              <p className="text-lg font-semibold font-mono">{totalIssued.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Counted by production</span>
              <p className="text-lg font-semibold font-mono">{totalCounted.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Still outstanding</span>
              <p
                className={`text-lg font-semibold font-mono ${
                  outstanding === 0 ? "text-success" : "text-warning"
                }`}
              >
                {outstanding.toLocaleString()}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                This material has not been issued against this voucher yet
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kit</TableHead>
                    <TableHead>Issued on</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Kit status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r: any) => {
                    const issued = Number(r.issued_quantity ?? 0);
                    const counted = r.received_quantity === null ? null : Number(r.received_quantity);
                    const diff = counted === null ? null : counted - issued;
                    const status = r.kit_preparation?.status ?? KIT_STATUS.PREPARED;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          {r.kit_preparation?.kit_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.kit_preparation?.sent_at
                            ? format(new Date(r.kit_preparation.sent_at), "dd MMM yyyy, HH:mm")
                            : format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {issued.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {counted === null ? (
                            <span className="text-muted-foreground">not counted</span>
                          ) : (
                            counted.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {diff === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : diff === 0 ? (
                            <span className="text-success">0</span>
                          ) : (
                            <span className="text-destructive">
                              {diff > 0 ? "+" : ""}
                              {diff.toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={kitStatusVariant(status)}>
                            {KIT_STATUS_LABELS[status as keyof typeof KIT_STATUS_LABELS] ?? status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDispatchHistoryDialog;
