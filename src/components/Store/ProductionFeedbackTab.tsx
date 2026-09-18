import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Check, X, Inbox } from "lucide-react";
import { format } from "date-fns";

/**
 * Store view of kit feedback raised by production.
 *
 * Production counts what actually arrived against what the store issued and raises
 * the difference here. Raising it moves no stock. The store accepting it is what
 * posts the correction to the main store, and the resulting ledger row is recorded
 * on the feedback so the adjustment can always be traced back to the decision that
 * caused it.
 *
 * Rejecting requires a reason - a rejection with no explanation is how a quantity
 * dispute turns into an argument between two departments.
 */
export const ProductionFeedbackTab = () => {
  const plantId = usePlantId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [acting, setActing] = useState<{ row: any; mode: "accept" | "reject" } | null>(null);
  const [remarks, setRemarks] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["kit-feedback", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_feedback")
        .select(`
          id, issued_quantity, received_quantity, variance, reason, status,
          raised_at, resolved_at, store_remarks,
          parts:part_id (part_code, name),
          production_orders:production_order_id (voucher_number)
        `)
        .eq("plant_id", plantId!)
        .order("status", { ascending: true })
        .order("raised_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, mode, text }: { id: string; mode: "accept" | "reject"; text: string }) => {
      const { error } =
        mode === "accept"
          ? await supabase.rpc("accept_kit_feedback", { p_feedback_id: id, p_remarks: text || null })
          : await supabase.rpc("reject_kit_feedback", { p_feedback_id: id, p_remarks: text });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["kit-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balance"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: v.mode === "accept" ? "Feedback accepted" : "Feedback rejected",
        description:
          v.mode === "accept"
            ? "Main store stock has been corrected and the adjustment recorded in the ledger."
            : "Production has been told why, and stock is unchanged.",
      });
      setActing(null);
      setRemarks("");
    },
    onError: (e: any) =>
      toast({
        title: "Could not resolve the feedback",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  const pending = rows.filter((r: any) => r.status === "PENDING");

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {pending.length > 0
          ? `${pending.length} awaiting your decision`
          : "Nothing awaiting a decision"}
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No feedback raised yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When production counts a kit and finds more or less than was issued, it
            appears here for you to accept or reject.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead>
                <TableHead>Part</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {r.production_orders?.voucher_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-medium">{r.parts?.part_code}</span>
                    <span className="block text-xs text-muted-foreground">{r.parts?.name}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.issued_quantity}</TableCell>
                  <TableCell className="text-right font-mono">{r.received_quantity}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    <span className={Number(r.variance) < 0 ? "text-destructive" : "text-green-600"}>
                      {Number(r.variance) > 0 ? "+" : ""}
                      {r.variance}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-sm truncate block" title={r.reason ?? ""}>
                      {r.reason || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.raised_at), "dd MMM, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "PENDING" ? "warning"
                        : r.status === "ACCEPTED" ? "default"
                        : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "PENDING" ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => { setActing({ row: r, mode: "accept" }); setRemarks(""); }}>
                          <Check className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setActing({ row: r, mode: "reject" }); setRemarks(""); }}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.store_remarks || "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acting?.mode === "accept" ? "Accept this feedback?" : "Reject this feedback?"}
            </DialogTitle>
            <DialogDescription>
              {acting?.mode === "accept" ? (
                <>
                  Main store stock for{" "}
                  <span className="font-mono">{acting?.row?.parts?.part_code}</span> will be
                  corrected by{" "}
                  <span className="font-semibold">
                    {Number(acting?.row?.variance) > 0 ? "" : "+"}
                    {-Number(acting?.row?.variance ?? 0)}
                  </span>
                  , and the adjustment recorded in the stock ledger against this decision.
                </>
              ) : (
                <>Stock will not change. Give production a reason — required.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={acting?.mode === "accept" ? "Remarks (optional)" : "Why is this being rejected?"}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActing(null)}>Cancel</Button>
            <Button
              disabled={resolve.isPending || (acting?.mode === "reject" && !remarks.trim())}
              onClick={() =>
                acting && resolve.mutate({ id: acting.row.id, mode: acting.mode, text: remarks.trim() })
              }
            >
              {acting?.mode === "accept" ? "Accept and correct stock" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductionFeedbackTab;
