
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Eye, Package } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shell/DataTable";
import { StatePill } from "@/components/shell/StatePill";

interface ProductionVoucherListProps {
  onSelectVoucher: (voucherId: string) => void;
}

interface ProductionVoucherRow extends Record<string, unknown> {
  id: string;
  voucher: string;
  product: string;
  customer: string;
  quantity: number;
  planDate: string;
  status: string;
  kitStatus: string;
}

const columns: DataTableColumn<ProductionVoucherRow>[] = [
  { key: "voucher", header: "Voucher", width: 116 },
  { key: "product", header: "Product", width: "auto", truncate: true },
  { key: "quantity", header: "Qty", width: 84, align: "right" },
  { key: "planDate", header: "Plan date", width: 96, align: "right" },
  { key: "status", header: "Status", width: 108 },
];

const getState = (status: string): "ok" | "warn" | "bad" | "idle" => {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED" || normalized === "OQC_PASSED") return "ok";
  if (normalized === "IN_PROGRESS" || normalized === "SCHEDULED") return "warn";
  if (normalized === "REJECTED" || normalized === "FAILED") return "bad";
  return "idle";
};

const ProductionVoucherList = memo(({ onSelectVoucher }: ProductionVoucherListProps) => {
  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders-list"],
    queryFn: async () => {
      console.log("🔍 Fetching production orders list...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          scheduled_date,
          status,
          kit_status,
          created_at,
          products!product_id (
            name
          ),
          production_schedules!production_schedule_id (
            projections!projection_id (
              customers!customer_id (name)
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50); // Limit for performance

      if (error) {
        console.error("❌ Error fetching production orders:", error);
        throw error;
      }

      console.log("📋 Production orders fetched:", data?.length || 0);
      return data || [];
    },
    refetchInterval: 30000, // Reduced frequency
    staleTime: 20000, // Cache for 20 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production vouchers...</p>
        </div>
      </div>
    );
  }

  const rows: ProductionVoucherRow[] = productionOrders.map((order) => ({
    id: order.id,
    voucher: order.voucher_number,
    product: order.products?.name || "Unknown product",
    customer: order.production_schedules?.projections?.customers?.name || "N/A",
    quantity: order.quantity,
    planDate: order.scheduled_date,
    status: order.status || "PENDING",
    kitStatus: order.kit_status || "NOT_READY",
  }));

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Package className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
        <p>No production vouchers found</p>
        <p className="mt-1 text-sm">Production vouchers will appear here when created</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      getRowState={(row) => {
        const state = getState(row.status);
        return state === "idle" ? null : state;
      }}
      renderCell={(row, column, { expanded, toggleExpanded }) => {
        switch (column.key) {
          case "voucher":
            return (
              <div className="flex min-w-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-5 shrink-0" onClick={toggleExpanded} aria-label={`${expanded ? "Hide" : "Show"} voucher details`}>
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
                <button type="button" className="truncate font-mono font-semibold text-foreground hover:text-primary" onClick={() => onSelectVoucher(row.id)}>
                  {row.voucher}
                </button>
              </div>
            );
          case "product": return row.product;
          case "quantity": return row.quantity.toLocaleString();
          case "planDate": return <span className="font-mono">{format(new Date(row.planDate), "dd MMM yy")}</span>;
          case "status": return <StatePill state={getState(row.status)}>{row.status.replace(/_/g, " ")}</StatePill>;
          default: return null;
        }
      }}
      renderExpanded={(row) => (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px]">
          <div><span className="text-muted-foreground">Customer</span><div className="mt-0.5 font-medium text-foreground">{row.customer}</div></div>
          <div><span className="text-muted-foreground">Kit status</span><div className="mt-0.5"><StatePill state={row.kitStatus === "PREPARED" ? "ok" : row.kitStatus === "PARTIAL" ? "warn" : row.kitStatus === "NOT_PREPARED" ? "bad" : "idle"}>{row.kitStatus.replace(/_/g, " ")}</StatePill></div></div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onSelectVoucher(row.id)}>
            <Eye className="h-3.5 w-3.5" />
            View details
          </Button>
        </div>
      )}
    />
  );
});

ProductionVoucherList.displayName = "ProductionVoucherList";

export default ProductionVoucherList;
