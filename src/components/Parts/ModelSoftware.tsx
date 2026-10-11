import { useState } from "react";
import { Cpu, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type SoftwareRelease, downloadSoftwareFile, fmtDay, useSoftwareReleases } from "@/hooks/useSoftwareReleases";

const FileLink = ({ path, name }: { path: string | null; name: string | null }) =>
  path ? (
    <button type="button" className="inline-flex max-w-[12rem] items-center gap-1 text-sm underline-offset-2 hover:underline" title={name ?? ""}
            onClick={() => downloadSoftwareFile(path, name ?? "file")}>
      <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span>
    </button>
  ) : <span className="text-sm text-muted-foreground">—</span>;

/**
 * The finished good's software: what R&D released and Management approved for
 * production on its model. Testing and release happen in R&D (product → Software).
 */
export function ModelSoftwarePanel({ modelId, modelCode }: { modelId?: string | null; modelCode: string }) {
  const { data = [], isLoading } = useSoftwareReleases(modelId);
  const [open, setOpen] = useState(false);
  if (!modelId) return null;
  const approved = data.filter((r) => r.status === "APPROVED");
  const current = approved.find((r) => r.in_production);

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">Software</span>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : !current ? <p className="text-sm text-muted-foreground">No software approved for {modelCode} yet.</p>
        : (
          <button type="button" onClick={() => setOpen(true)}
                  className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
            <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-mono font-medium">v{current.version}</span>
              <span className="block truncate text-xs text-muted-foreground">{current.file_name}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-muted-foreground">
              in production<br />{approved.length > 1 ? `${approved.length} versions` : fmtDay(current.decided_at)}
            </span>
          </button>
        )}
      {open && <SoftwareHistoryDialog modelCode={modelCode} releases={approved} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SoftwareHistoryDialog({ modelCode, releases, onClose }: { modelCode: string; releases: SoftwareRelease[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,1100px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelCode} · Software</DialogTitle>
          <DialogDescription>Versions approved for production, newest first. Testing and release are done in R&amp;D.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Version</TableHead>
                <TableHead>Software file</TableHead>
                <TableHead>Testing report</TableHead>
                <TableHead>Issue list</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-40">Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="whitespace-nowrap">
                    <span className="font-mono">v{r.version}</span>
                    {r.in_production && <Badge className="ml-1.5">in production</Badge>}
                  </TableCell>
                  <TableCell><FileLink path={r.file_path} name={r.file_name} /></TableCell>
                  <TableCell><FileLink path={r.test_report_path} name={r.test_report_name} /></TableCell>
                  <TableCell><FileLink path={r.issue_list_path} name={r.issue_list_name} /></TableCell>
                  <TableCell className="whitespace-pre-wrap text-sm">{r.details ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDay(r.decided_at)}<br />{r.decided_by_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
