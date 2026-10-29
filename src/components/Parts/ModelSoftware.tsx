import { useQuery } from "@tanstack/react-query";
import { Cpu, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadSoftwareFile, fmtDay, fmtSize, shortSum, useSoftwareInProduction } from "@/hooks/useSoftwareReleases";

const db = supabase as any;

/**
 * The software version in production of a brand code: version, approval date
 * and checksum. R&D, Management and Admin can also download the file (the
 * storage only gives it to them); testing and release are done in R&D.
 */
export function ModelSoftwarePanel({ partId, isModel }: { partId?: string | null; isModel?: boolean }) {
  // A model (JA-006) shows each of its brand codes; a brand code shows its own.
  const { data: codes = [] } = useQuery({
    queryKey: ["brand-codes-of", partId, isModel],
    enabled: !!partId,
    queryFn: async () => {
      if (!isModel) {
        const { data } = await db.from("parts").select("id, part_code").eq("id", partId).maybeSingle();
        return data ? [data] : [];
      }
      const { data, error } = await db.from("parts").select("id, part_code").eq("model_id", partId).eq("is_active", true).order("part_code");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: sw, isLoading } = useSoftwareInProduction(codes.map((c: any) => c.id));
  const { canApprove } = usePermissions();
  const { canAccessModule } = useAuth() as any;
  const canDownload = canApprove || !!canAccessModule?.("rnd");
  const { data: files } = useQuery({
    queryKey: ["software-in-production-files", codes.map((c: any) => c.id).join(",")],
    enabled: canDownload && codes.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("software_release_history").select("part_id, file_path, file_name, file_size")
        .eq("in_production", true).in("part_id", codes.map((c: any) => c.id));
      if (error) throw error;
      return new Map<string, { file_path: string; file_name: string; file_size: number | null }>((data ?? []).map((r: any) => [r.part_id, r]));
    },
  });
  if (!partId) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">Software</span>
      {!codes.length ? <p className="text-sm text-muted-foreground">{isModel ? "No brand codes yet." : "—"}</p>
        : isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : codes.map((c: any) => {
          const s = sw?.get(c.id);
          return (
            <div key={c.id} className="space-y-1 rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {isModel && <span className="mr-2 font-mono text-xs text-muted-foreground">{c.part_code}</span>}
                  {s ? <span className="font-mono font-medium">v{s.version}</span> : <span className="text-destructive">No approved software</span>}
                </span>
                {s && files?.get(c.id) && (
                  <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2" title={`${files.get(c.id)!.file_name} · ${fmtSize(files.get(c.id)!.file_size)}`}
                          onClick={() => downloadSoftwareFile(files.get(c.id)!.file_path, files.get(c.id)!.file_name)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                )}
              </div>
              {s && (
                <div className="pl-6 text-xs text-muted-foreground" title={s.sha256 ?? ""}>
                  Approved {fmtDay(s.activated_at)}{s.bom_version ? ` · BOM v${s.bom_version}` : ""}{s.sha256 ? ` · ${shortSum(s.sha256)}` : ""}
                </div>
              )}
            </div>
          );
        })}
      <p className="text-xs text-muted-foreground">{canDownload ? "Downloads the version in production. Older versions and testing are in R&D." : "Files are kept in R&D."}</p>
    </div>
  );
}

/** One line for a production voucher: the version to load, or a warning. */
export function VoucherSoftware({ partId }: { partId?: string | null }) {
  const { data: sw, isLoading } = useSoftwareInProduction(partId ? [partId] : []);
  if (!partId || isLoading) return null;
  const s = sw?.get(partId);
  return s ? (
    <p className="font-medium">
      <span className="font-mono">v{s.version}</span>
      <span className="ml-1 text-xs font-normal text-muted-foreground" title={s.sha256 ?? ""}>approved {fmtDay(s.activated_at)}{s.bom_version ? ` · made for BOM v${s.bom_version}` : ""}{s.sha256 ? ` · ${shortSum(s.sha256)}` : ""}</span>
    </p>
  ) : <p className="font-medium text-destructive">No approved software. Check with R&amp;D before loading.</p>;
}
