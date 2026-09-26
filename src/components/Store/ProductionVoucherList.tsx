import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Eye, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Production vouchers in the Store.
 *
 * Rebuilt on the house components (Table / Badge / Button). This file and
 * ProductionVoucherDetails were the only two screens in the app using the bespoke
 * DataTable + StatePill shell - 134 other files use plain Card + Table + Badge - so
 * they read as a different product. They were the outlier, not the standard.
 */

interface ProductionVoucherListProps {
  onSelectVoucher: (voucherId: string) => void;
}

const statusVariant = (status: string) => {
  switch (status) {
    case "COMPLETED":
    case "OQC_PASSED":
      return "default" as const;
    case "IN_PRODUCTION":
    case "KIT_SENT":
    case "KIT_PREPARED":
      return "warning" as const;
    case "OQC_FAILED":
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

const ProductionVoucherList = memo(({ onSelectVoucher }: ProductionVoucherListProps) => {
  const plantId = usePlantId();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["production-orders-list", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          produced_quantity,
          planned_date,
          status,
          kit_preparation ( status ),
          parts!part_id ( part_code, name ),
          production_schedules!production_schedule_id (
            projections!projection_id ( customers!customer_id ( name ) )
          )
        `)
        .eq("plant_id", plantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Loading production vouchers…</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No production vouchers yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          They appear here once production is scheduled from Planning.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Voucher</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Produced</TableHead>
            <TableHead>Plan Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o: any) => {
            const isOpen = expanded === o.id;
            const kitStatus = o.kit_preparation?.[0]?.status ?? null;
            return (
              <>
                <TableRow key={o.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setExpanded(isOpen ? null : o.id)}
                      aria-label={isOpen ? "Hide details" : "Show details"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono font-medium hover:text-primary"
                      onClick={() => onSelectVoucher(o.id)}
                    >
                      {o.voucher_number}
                    </button>
                  </TableCell>
                  <TableCell>
                    {o.parts?.name ?? "—"}
                    <span className="block text-xs font-mono text-muted-foreground">
                      {o.parts?.part_code}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(o.quantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {Number(o.produced_quantity ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.planned_date ? format(new Date(o.planned_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(o.status)}>
                      {String(o.status).replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onSelectVoucher(o.id)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow key={`${o.id}-detail`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell />
                    <TableCell colSpan={7}>
                      <div className="flex flex-wrap gap-x-10 gap-y-3 py-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Customer</span>
                          <div className="font-medium">
                            {o.production_schedules?.projections?.customers?.name ?? "Stock build"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Kit</span>
                          <div className="font-medium">
                            {kitStatus ? (
                              <Badge variant={kitStatus === "SENT" ? "default" : "secondary"}>
                                {kitStatus}
                              </Badge>
                            ) : (
                              // No kit_preparation row IS "not prepared" - there is no
                              // separate flag to disagree with.
                              <span className="text-muted-foreground">Not prepared</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Balance to produce</span>
                          <div className="font-medium font-mono">
                            {(Number(o.quantity) - Number(o.produced_quantity ?? 0)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

ProductionVoucherList.displayName = "ProductionVoucherList";

export default ProductionVoucherList;
