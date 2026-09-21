import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

/**
 * Quantity differences the store found when counting a GRN in.
 *
 * On GRN-202609-00005 the store counted 90,000 against the 99,000 IQC passed.
 * Stock was right - the store's count is what got posted - but 9,000 pieces were
 * unaccounted for and this tab said "not available after the rebuild", because it
 * had been built on store_discrepancies, dropped with no replacement. So the one
 * screen whose job is to surface a shortfall to the people who deal with vendors
 * showed nothing, and nobody knew.
 *
 * No table was needed to find the difference: grn_items already holds both
 * numbers, so the tab reads a view. What the rebuild adds is the decision, because
 * a variance is a question with four different answers and each one costs someone
 * something:
 *
 *   Short supply    the vendor never sent them  -> goes back on the PO as owed,
 *                                                  and is claimed from the vendor
 *   IQC miscount    IQC's figure was wrong      -> IQC's numbers are corrected
 *   Store recount   the material was found      -> stock is corrected
 *   Write-off       lost, and we bear it        -> recorded, nothing moves
 */

const RESOLUTIONS = [
  {
    value: "SHORT_SUPPLY",
    label: "Short supply — claim from the vendor",
    effect:
      "The quantity goes back onto the PO as still owed, a CAPA is raised against the vendor, " +
      "and the claim is emailed to them with the GRN, the part and the quantities.",
  },
  {
    value: "IQC_MISCOUNT",
    label: "IQC miscount — correct IQC",
    effect: "What reached the store becomes the accepted figure. The PO is unchanged.",
  },
  {
    value: "STORE_RECOUNT",
    label: "Store recount — the material was found",
    effect: "Stock is corrected by the difference and the ledger records why.",
  },
  {
    value: "WRITE_OFF",
    label: "Write off — we bear the loss",
    effect: "Stock already matches the count, so nothing moves. The decision is recorded.",
  },
] as const;

const StoreDiscrepancies = () => {
  const plantId = usePlantId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [acting, setActing] = useState<any>(null);
  const [resolution, setResolution] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["store-receiving-variances", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_receiving_variances")
        .select("*")
        .eq("plant_id", plantId!)
        .order("is_open", { ascending: false })
        .order("store_confirmed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("resolve_store_variance", {
        p_grn_item_id: acting.grn_item_id,
        p_resolution: resolution,
        p_remarks: remarks.trim(),
      });
      if (error) throw error;

      // Ruling "short supply" IS the ruling that this is the vendor's. So the
      // claim and the mail follow from it rather than waiting for somebody to
      // remember, open Outlook and retype the GRN number. The other three
      // resolutions are ours to carry and nothing leaves the building.
      if (resolution !== "SHORT_SUPPLY") return null;

      const { data, error: capaError } = await supabase.rpc("raise_vendor_capa", {
        p_grn_item_id: acting.grn_item_id,
        p_problem: remarks.trim() || null,
      });
      if (capaError) throw capaError;

      // Posting is a separate step from raising, so a mail provider that is down
      // cannot roll back a CAPA that was correctly raised. The claim is on the
      // record either way; the mail waits in the outbox.
      await supabase.functions.invoke("send-vendor-notifications").catch(() => undefined);
      return data as any;
    },
    onSuccess: (claim: any) => {
      queryClient.invalidateQueries({ queryKey: ["store-receiving-variances"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] });
      toast({
        title: claim ? `Variance resolved — ${claim.capa_number} raised` : "Variance resolved",
        description: claim
          ? claim.emailed
            ? `The claim has been sent to ${claim.to}.`
            : `The claim is on the record, but ${claim.reason}.`
          : RESOLUTIONS.find((r) => r.value === resolution)?.effect,
      });
      setActing(null);
      setResolution("");
      setRemarks("");
    },
    onError: (e: any) =>
      toast({
        title: "Could not resolve the variance",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });

  const open = rows.filter((r: any) => r.is_open);

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Store receiving variances
          {open.length > 0 && (
            <Badge variant="destructive">{open.length} open</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Lines where the store counted a different quantity than IQC passed. Stock
          already reflects what the store counted — what is open here is who bears
          the difference.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No receiving variances</p>
            <p className="text-sm text-muted-foreground mt-1">
              Every GRN line the store has counted matches what IQC passed.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Part</TableHead>
                  <TableHead className="text-right">IQC passed</TableHead>
                  <TableHead className="text-right">Store counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Counted on</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.grn_item_id}>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {r.grn_number}
                    </TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {r.po_number ?? "—"}
                    </TableCell>
                    <TableCell>{r.vendor_name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{r.part_code}</span>
                      <span className="block text-xs text-muted-foreground">{r.part_name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.iqc_accepted_quantity ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.store_counted_quantity ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      <span className={Number(r.variance) < 0 ? "text-destructive" : "text-green-600"}>
                        {Number(r.variance) > 0 ? "+" : ""}
                        {Number(r.variance).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {r.store_confirmed_at
                        ? format(new Date(r.store_confirmed_at), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {r.is_open ? (
                        <Badge variant="destructive">Open</Badge>
                      ) : (
                        <div>
                          <Badge variant="default">
                            {String(r.resolution).replace(/_/g, " ").toLowerCase()}
                          </Badge>
                          {r.claim_quantity && (
                            <span className="block text-xs text-muted-foreground mt-1">
                              claim {Number(r.claim_quantity).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.is_open ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActing(r);
                            setResolution("");
                            setRemarks("");
                          }}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground block max-w-[16rem] truncate"
                          title={r.resolution_remarks ?? ""}
                        >
                          {r.resolution_remarks}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve receiving variance</DialogTitle>
            <DialogDescription>
              {acting && (
                <>
                  <span className="font-mono">{acting.part_code}</span> on{" "}
                  <span className="font-mono">{acting.grn_number}</span> from{" "}
                  {acting.vendor_name ?? "an unnamed vendor"}: IQC passed{" "}
                  {Number(acting.iqc_accepted_quantity ?? 0).toLocaleString()}, the store
                  counted {Number(acting.store_counted_quantity ?? 0).toLocaleString()} —
                  a difference of{" "}
                  <span className="font-semibold">
                    {Number(acting.variance).toLocaleString()}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What happened?</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a resolution" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resolution && (
                <p className="text-xs text-muted-foreground">
                  {RESOLUTIONS.find((r) => r.value === resolution)?.effect}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="variance-remarks">What was found — required</Label>
              <Textarea
                id="variance-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Who counted it, with whom, and what was agreed"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!resolution || !remarks.trim() || resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              Record resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StoreDiscrepancies;
