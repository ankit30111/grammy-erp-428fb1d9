import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FlaskConical, Plus } from "lucide-react";
import { format } from "date-fns";

/**
 * Sample rounds for one NPD project.
 *
 * The previous version was written against a different model: it filtered
 * npd_sample_tracking on npd_bom_material_id, embedded npd_bom_materials, and
 * wrote part_status, temporary_part_code, sample_target_date, is_temporary_part
 * and final_part_code. None of those columns exist. npd_sample_tracking hangs off
 * the PROJECT, not off a BOM line, and records rounds: which round, when it was
 * asked for, when it came back, how many, and how it went.
 *
 * So every query here returned an error the screen discarded, and every write
 * failed. It has been rebuilt against what the schema actually holds rather than
 * having the missing columns invented back, because a sample round is a property
 * of the project iteration - asking a vendor for round 2 is one event, not one per
 * line in the BOM.
 */

const OUTCOMES = ["AWAITED", "PASSED", "FAILED", "PARTIAL"] as const;

const outcomeVariant = (outcome: string | null) => {
  switch (outcome) {
    case "PASSED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    case "PARTIAL":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
};

interface SampleTrackingViewProps {
  /** The NPD project id. Named bomId by the callers, which pass projectId. */
  bomId: string;
  onClose?: () => void;
}

export const SampleTrackingView = ({ bomId }: SampleTrackingViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    quantity: "",
    requested_on: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const { data: rounds = [], isLoading } = useQuery({
    queryKey: ["npd-sample-tracking", bomId],
    enabled: !!bomId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("npd_sample_tracking")
        .select("id, sample_round, requested_on, received_on, quantity, outcome, notes")
        .eq("project_id", bomId)
        .order("sample_round", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addRound = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("Enter how many samples were asked for");
      }
      // Round numbers follow the rounds already recorded rather than being typed
      // in, so two people cannot both create "round 3".
      const nextRound =
        rounds.reduce((m: number, r: any) => Math.max(m, Number(r.sample_round ?? 0)), 0) + 1;

      const { error } = await supabase.from("npd_sample_tracking").insert({
        project_id: bomId,
        sample_round: nextRound,
        requested_on: form.requested_on || null,
        quantity: qty,
        outcome: "AWAITED",
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["npd-sample-tracking", bomId] });
      toast({ title: "Sample round recorded" });
      setAdding(false);
      setForm({ quantity: "", requested_on: new Date().toISOString().split("T")[0], notes: "" });
    },
    onError: (e: Error) =>
      toast({ title: "Could not record the round", description: e.message, variant: "destructive" }),
  });

  const recordOutcome = useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: string }) => {
      const { error } = await supabase
        .from("npd_sample_tracking")
        .update({
          outcome,
          // Anything other than still-waiting means the samples are back.
          received_on: outcome === "AWAITED" ? null : new Date().toISOString().split("T")[0],
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["npd-sample-tracking", bomId] });
      toast({ title: "Outcome recorded" });
    },
    onError: (e: Error) =>
      toast({ title: "Could not record the outcome", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Sample Rounds
        </CardTitle>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New round
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        ) : rounds.length === 0 ? (
          <div className="py-10 text-center">
            <FlaskConical className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No sample rounds recorded yet</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Round</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Record outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">#{r.sample_round}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {r.requested_on ? format(new Date(r.requested_on), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {r.received_on ? format(new Date(r.received_on), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.quantity === null ? "—" : Number(r.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={outcomeVariant(r.outcome)}>{r.outcome ?? "AWAITED"}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="block truncate text-sm" title={r.notes ?? ""}>
                        {r.notes || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={r.outcome ?? "AWAITED"}
                        onValueChange={(v) => recordOutcome.mutate({ id: r.id, outcome: v })}
                      >
                        <SelectTrigger className="w-36 ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTCOMES.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New sample round</DialogTitle>
            <DialogDescription>
              The round number follows the rounds already recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity requested</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req">Requested on</Label>
              <Input
                id="req"
                type="date"
                value={form.requested_on}
                onChange={(e) => setForm({ ...form, requested_on: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="What is being checked in this round?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button disabled={addRound.isPending} onClick={() => addRound.mutate()}>
              Record round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SampleTrackingView;
