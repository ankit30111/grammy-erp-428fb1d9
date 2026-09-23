import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { useBomLines } from "@/hooks/useBOM";
import { useParts } from "@/hooks/useParts";
import { usePermissions } from "@/hooks/usePermissions";

type Item = {
  kind: "PART" | "VENDOR" | "CUSTOMER" | "BOM";
  id: string; code: string; name: string; detail: string | null;
  parent_part_id: string | null;
  lines: { child_part_id: string; quantity: number }[] | null;
  submitted_by_name: string | null; submitted_at: string;
};

const KIND_LABEL: Record<Item["kind"], string> = {
  PART: "New part code", VENDOR: "New vendor", CUSTOMER: "New customer", BOM: "BOM change",
};

/** What R&D has created or changed, waiting for Management or Admin. */
export default function MasterApprovalsTab() {
  const qc = useQueryClient();
  const { canApprove } = usePermissions();
  const { parts } = useParts();
  const { data: live = [] } = useBomLines();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["master-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_master_approvals" as any);
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const partById = useMemo(() => new Map((parts as any[]).map((p) => [p.id, p])), [parts]);

  const review = useMutation({
    mutationFn: async ({ item, approve }: { item: Item; approve: boolean }) => {
      const reason = reasons[item.id]?.trim() || null;
      if (!approve && !reason) throw new Error("Write why it is rejected, so it can be fixed");
      const { error } = item.kind === "BOM"
        ? await supabase.rpc("review_bom_change" as any, { p_id: item.id, p_approve: approve, p_reason: reason })
        : await supabase.rpc("review_master" as any, { p_kind: item.kind, p_id: item.id, p_approve: approve, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: (_d, { item, approve }) => {
      toast.success(`${item.code} ${approve ? "approved" : "rejected"}`);
      for (const k of ["master-approvals", "parts", "vendors", "customers", "bom-lines", "bom-change-requests"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // What the BOM change does against the BOM in use now.
  const bomDiff = (item: Item) => {
    const now = new Map((live as any[]).filter((l) => l.parent_part_id === item.parent_part_id)
      .map((l) => [l.child_part_id, Number(l.quantity)]));
    const next = new Map((item.lines ?? []).map((l) => [l.child_part_id, Number(l.quantity)]));
    const rows: { id: string; change: "Added" | "Removed" | "QPS changed"; from?: number; to?: number }[] = [];
    next.forEach((q, id) => {
      if (!now.has(id)) rows.push({ id, change: "Added", to: q });
      else if (now.get(id) !== q) rows.push({ id, change: "QPS changed", from: now.get(id), to: q });
    });
    now.forEach((q, id) => { if (!next.has(id)) rows.push({ id, change: "Removed", from: q }); });
    return rows;
  };

  if (isLoading) {
    return <Card><CardContent className="pt-6"><Table><TableBody><TableSkeleton columns={4} rows={3} /></TableBody></Table></CardContent></Card>;
  }
  if (!items.length) {
    return (
      <Card><CardContent className="pt-6"><Table><TableBody>
        <TableEmpty columns={1} message="Nothing waiting for approval" hint="Part codes, BOM changes and vendors that R&D creates appear here." />
      </TableBody></Table></CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const diff = item.kind === "BOM" ? bomDiff(item) : [];
        const pendingInside = item.kind === "BOM"
          ? [item.parent_part_id, ...(item.lines ?? []).map((l) => l.child_part_id)]
              .map((id) => partById.get(id as string))
              .filter((p: any) => p?.approval_status === "PENDING")
          : [];
        return (
          <Card key={`${item.kind}-${item.id}`}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                  <span className="font-mono normal-case tracking-normal text-foreground">{item.code}</span>
                  <span className="normal-case tracking-normal text-foreground">{item.name}</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {item.submitted_by_name ?? "Someone"} · {new Date(item.submitted_at).toLocaleString()}
                </span>
              </div>
              {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              {item.kind === "BOM" && (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead className="text-right">QPS now</TableHead>
                        <TableHead className="text-right">QPS proposed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diff.length === 0 ? (
                        <TableEmpty columns={4} message="Same as the BOM in use" />
                      ) : diff.map((d) => {
                        const p: any = partById.get(d.id);
                        return (
                          <TableRow key={d.id}>
                            <TableCell><span className="font-mono">{p?.part_code}</span> {p?.name}</TableCell>
                            <TableCell>{d.change}</TableCell>
                            <TableCell className="text-right tabular-nums">{d.from ?? "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{d.to ?? "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground">
                    {(item.lines ?? []).length} lines in the proposed BOM.
                    {pendingInside.length > 0 &&
                      ` Approving also approves the new part code${pendingInside.length > 1 ? "s" : ""} in it: ${pendingInside.map((p: any) => p.part_code).join(", ")}.`}
                  </p>
                </>
              )}
              {canApprove && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="min-w-[220px] flex-1" placeholder="Reason (needed to reject)"
                         value={reasons[item.id] ?? ""}
                         onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))} />
                  <Button variant="outline" disabled={review.isPending} onClick={() => review.mutate({ item, approve: false })}>
                    <X /> Reject
                  </Button>
                  <Button disabled={review.isPending} onClick={() => review.mutate({ item, approve: true })}>
                    <Check /> Approve
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
