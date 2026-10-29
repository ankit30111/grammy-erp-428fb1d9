import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { EcnCenter } from "@/components/Engineering/EcnCenter";
import { useEcns } from "@/hooks/useEcns";
import { downloadSoftwareFile } from "@/hooks/useSoftwareReleases";

const db = supabase as any;
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");

type Queue = "management" | "rnd";

/** Software versions waiting for a step: TESTING → R&D check, RD_CHECKED → Management. */
function useSoftwareQueue() {
  return useQuery({
    queryKey: ["software-queue"],
    queryFn: async () => {
      const { data, error } = await db.from("software_release_history")
        .select("id, kind, version, status, part_code, brand, model_id, created_at, created_by_name, rd_checked_at, rd_checked_by_name, file_path, file_name, test_report_path, test_report_name, issue_list_path, issue_list_name")
        .in("status", ["TESTING", "RD_CHECKED"]).order("created_at");
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r: any) => r.model_id))];
      const { data: models } = ids.length ? await db.from("parts").select("id, part_code").in("id", ids) : { data: [] };
      const code = new Map((models ?? []).map((m: any) => [m.id, m.part_code]));
      return rows.map((r: any) => ({ ...r, model_code: code.get(r.model_id) as string | undefined }));
    },
  });
}

/** Counts for the Approvals tab labels. */
export function useEngineeringCounts() {
  const { data: ecns = [] } = useEcns();
  const { data: sw = [] } = useSoftwareQueue();
  return {
    management: ecns.filter((e) => e.status === "SUBMITTED").length + sw.filter((s: any) => s.status === "RD_CHECKED").length,
    rnd: ecns.filter((e) => e.status === "DRAFT").length + sw.filter((s: any) => s.status === "TESTING").length,
  };
}

export function EngineeringApprovals({ queue }: { queue: Queue }) {
  const { canApprove } = usePermissions();
  const { canAccessModule } = useAuth() as any;
  const isRnd = canAccessModule?.("rnd");
  const { data: sw = [], isLoading } = useSoftwareQueue();
  const qc = useQueryClient();
  const [reject, setReject] = useState<{ id: string; text: string } | null>(null);
  const step = queue === "management" ? "RD_CHECKED" : "TESTING";
  const rows = sw.filter((s: any) => s.status === step);
  const canAct = queue === "management" ? canApprove : isRnd || canApprove;

  const act = useMutation({
    mutationFn: async (a: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await db.from("software_releases").update(a.patch).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: (_d, a) => {
      qc.invalidateQueries({ predicate: (q) => /^(software|plm)/.test(String(q.queryKey[0] ?? "")) });
      toast.success(a.patch.status === "APPROVED" ? "Approved for production" : a.patch.status === "RD_CHECKED" ? "R&D check done; sent to Management" : "Rejected");
      setReject(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Engineering changes (ECN)</h2>
          <p className="text-xs text-muted-foreground">
            {queue === "management" ? "Sent by R&D. Approve & release puts the change into production; Send back returns it to R&D with a note."
              : "Being prepared or sent back by Management. Finish them and send them to Management."}
          </p>
        </div>
        <EcnCenter queue={queue} />
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Software releases</h2>
          <p className="text-xs text-muted-foreground">
            {queue === "management" ? "R&D has checked these versions. Approving puts the version into production for that brand code."
              : "Uploaded for testing. R&D checks the file, testing report and issue list, then it goes to Management."}
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Software</TableHead><TableHead>Version</TableHead><TableHead>Documents</TableHead>
                    <TableHead>{queue === "management" ? "R&D check" : "Uploaded"}</TableHead><TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                    : !rows.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nothing waiting.</TableCell></TableRow>
                    : rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          <div className="font-mono font-medium">{r.kind === "BASE" ? `${r.model_code ?? ""} · base` : r.part_code}</div>
                          {r.model_code && <Link className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                                                 to={`/rnd/products/${encodeURIComponent(r.model_code)}?tab=versions`}>Open in R&amp;D <ExternalLink className="h-3 w-3" /></Link>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono">{r.kind === "BASE" ? `B${r.version}` : `v${r.version}`}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <button type="button" className="underline-offset-2 hover:underline" onClick={() => downloadSoftwareFile(r.file_path, r.file_name)}>File</button>
                            {r.test_report_path ? <button type="button" className="underline-offset-2 hover:underline" onClick={() => downloadSoftwareFile(r.test_report_path, r.test_report_name)}>Testing report</button>
                              : <span className="text-muted-foreground">no testing report</span>}
                            {r.issue_list_path ? <button type="button" className="underline-offset-2 hover:underline" onClick={() => downloadSoftwareFile(r.issue_list_path, r.issue_list_name)}>Issue list</button>
                              : <span className="text-muted-foreground">no issue list</span>}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {queue === "management" ? `${fmtDate(r.rd_checked_at)} · ${r.rd_checked_by_name ?? ""}` : `${fmtDate(r.created_at)} · ${r.created_by_name ?? ""}`}
                        </TableCell>
                        <TableCell className="text-right">
                          {canAct && (reject?.id === r.id ? (
                            <form className="flex justify-end gap-1" onSubmit={(e) => { e.preventDefault(); act.mutate({ id: r.id, patch: { status: "REJECTED", decision_note: reject.text } }); }}>
                              <Input autoFocus className="h-8 w-48" placeholder="Why it is rejected" value={reject.text} onChange={(e) => setReject({ id: r.id, text: e.target.value })} />
                              <Button size="sm" variant="destructive" type="submit" disabled={!reject.text.trim()}>Reject</Button>
                              <Button size="sm" variant="ghost" type="button" onClick={() => setReject(null)}>×</Button>
                            </form>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReject({ id: r.id, text: "" })}>Reject</Button>
                              <Button size="sm" disabled={act.isPending}
                                      onClick={() => act.mutate({ id: r.id, patch: { status: queue === "management" ? "APPROVED" : "RD_CHECKED" } })}>
                                {queue === "management" ? "Approve" : "Checked OK"}
                              </Button>
                            </div>
                          ))}
                          {!canAct && <Badge variant="outline">{queue === "management" ? "Management" : "R&D"}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
