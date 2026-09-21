import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KIT_STATUS, KIT_STATUS_LABELS, kitStatusVariant, type KitStatus } from "@/constants/kitStatus";

/**
 * Production counts what actually arrived in a kit.
 *
 * Two things were broken here and they hid each other:
 *
 * 1. It filtered kits on "COMPLETE KIT SENT" and four assembly-type variants. The
 *    store writes "SENT". The screen was therefore permanently empty, and an empty
 *    screen reads as "no kits", not as a broken filter.
 * 2. It wrote kit_items.verified_by_production, a column that does not exist, and
 *    treated received_quantity as the quantity sent. So even with rows on screen,
 *    counting a kit recorded nothing and compared against the wrong number.
 *
 * Counting is now one call to record_kit_receipt(): it writes what production
 * received and, where that differs from what the store issued, files a kit_feedback
 * claim. It moves no stock. Only the store accepting that claim corrects the main
 * store, which is the loop the floor actually runs.
 */

interface KitLine {
  id: string;
  part_id: string;
  required_quantity: number;
  issued_quantity: number | null;
  received_quantity: number | null;
  parts: { part_code: string; name: string } | null;
}

interface KitRow {
  id: string;
  kit_number: string;
  status: KitStatus;
  production_orders: { voucher_number: string; quantity: number; parts: { name: string } | null } | null;
  kit_items: KitLine[];
}

const KitVerification = () => {
  const plantId = usePlantId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const kitQuery = (statuses: KitStatus[]) => async () => {
    const { data, error } = await supabase
      .from("kit_preparation")
      .select(`
        id,
        kit_number,
        status,
        production_orders!production_order_id (
          voucher_number,
          quantity,
          parts!part_id ( name )
        ),
        kit_items (
          id,
          part_id,
          required_quantity,
          issued_quantity,
          received_quantity,
          parts!part_id ( part_code, name )
        )
      `)
      .eq("plant_id", plantId!)
      .in("status", statuses)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as KitRow[];
  };

  const { data: toCount = [], isLoading } = useQuery({
    queryKey: ["kits-to-count", plantId],
    enabled: !!plantId,
    queryFn: kitQuery([KIT_STATUS.SENT]),
  });

  const { data: counted = [] } = useQuery({
    queryKey: ["kits-counted", plantId],
    enabled: !!plantId,
    queryFn: kitQuery([KIT_STATUS.RECEIVED, KIT_STATUS.DISPUTED]),
  });

  const recordReceipt = useMutation({
    mutationFn: async (kit: KitRow) => {
      const lines = kit.kit_items.map((item) => {
        const issued = Number(item.issued_quantity ?? 0);
        const raw = counts[item.id];
        const received = raw === undefined || raw === "" ? issued : Number(raw);
        if (!Number.isFinite(received) || received < 0) {
          throw new Error(`Enter a valid count for ${item.parts?.part_code ?? "this line"}`);
        }
        if (received !== issued && !reasons[item.id]?.trim()) {
          throw new Error(
            `Give a reason for the difference on ${item.parts?.part_code ?? "this line"}`
          );
        }
        return {
          kit_item_id: item.id,
          received_quantity: received,
          reason: reasons[item.id]?.trim() || null,
        };
      });

      const { data, error } = await supabase.rpc("record_kit_receipt", {
        p_kit_id: kit.id,
        p_lines: lines,
        p_notes: null,
      });
      if (error) throw error;
      // The function returns one row: how many lines went to the store as a claim.
      const disputed = Array.isArray(data) ? Number(data[0]?.disputed_count ?? 0) : 0;
      return { disputed };
    },
    onSuccess: ({ disputed }) => {
      queryClient.invalidateQueries({ queryKey: ["kits-to-count"] });
      queryClient.invalidateQueries({ queryKey: ["kits-counted"] });
      queryClient.invalidateQueries({ queryKey: ["kit-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["voucher-kit-statuses"] });
      toast({
        title: disputed > 0 ? "Sent to the store for a decision" : "Kit receipt recorded",
        description:
          disputed > 0
            ? `${disputed} line${disputed === 1 ? "" : "s"} differ from what was issued. Stock is unchanged until the store accepts.`
            : "Counts match what the store issued.",
      });
      setCounts({});
      setReasons({});
    },
    onError: (e: Error) =>
      toast({ title: "Could not record the count", description: e.message, variant: "destructive" }),
  });

  const renderKits = (kits: KitRow[], editable: boolean) => (
    <div className="space-y-8">
      {kits.map((kit) => (
        <div key={kit.id} className="rounded-lg border p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">
                {kit.production_orders?.voucher_number ?? "—"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {kit.production_orders?.parts?.name ?? "—"} · Kit {kit.kit_number}
              </p>
            </div>
            <Badge variant={kitStatusVariant(kit.status)}>
              {KIT_STATUS_LABELS[kit.status] ?? kit.status}
            </Badge>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Issued by store</TableHead>
                  <TableHead className="text-right">Counted here</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  {editable && <TableHead>Reason for difference</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kit.kit_items.map((item) => {
                  const issued = Number(item.issued_quantity ?? 0);
                  const raw = counts[item.id];
                  const received = editable
                    ? raw === undefined || raw === "" ? issued : Number(raw)
                    : Number(item.received_quantity ?? 0);
                  const diff = received - issued;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium whitespace-nowrap">
                        {item.parts?.part_code ?? "—"}
                      </TableCell>
                      <TableCell>{item.parts?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {Number(item.required_quantity).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {issued.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? (
                          <Input
                            type="number"
                            min={0}
                            className="w-28 ml-auto text-right"
                            value={raw ?? String(issued)}
                            onChange={(e) =>
                              setCounts((p) => ({ ...p, [item.id]: e.target.value }))
                            }
                          />
                        ) : (
                          <span className="font-mono">{received.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {diff === 0 ? (
                          <span className="text-green-600">0</span>
                        ) : (
                          <span className="text-destructive">
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      {editable && (
                        <TableCell>
                          {diff !== 0 && (
                            <Textarea
                              placeholder="Required — what happened?"
                              value={reasons[item.id] ?? ""}
                              onChange={(e) =>
                                setReasons((p) => ({ ...p, [item.id]: e.target.value }))
                              }
                              className="min-h-[60px]"
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {editable && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Recording a count moves no stock. Any difference goes to the store to
                accept or reject, and only acceptance corrects the main store.
              </p>
              <Button
                onClick={() => recordReceipt.mutate(kit)}
                disabled={recordReceipt.isPending}
              >
                {recordReceipt.isPending ? "Recording…" : "Record what we received"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Kit Receipt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="to-count" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="to-count" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                To count ({toCount.length})
              </TabsTrigger>
              <TabsTrigger value="counted" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Counted ({counted.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="to-count" className="mt-6">
              {toCount.length === 0 ? (
                <div className="py-10 text-center">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No kits waiting to be counted</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Kits appear here once the store issues them to production.
                  </p>
                </div>
              ) : (
                renderKits(toCount, true)
              )}
            </TabsContent>

            <TabsContent value="counted" className="mt-6">
              {counted.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  Nothing counted yet
                </div>
              ) : (
                renderKits(counted, false)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default KitVerification;
