import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDay, shortSum, useSoftwareInProduction } from "@/hooks/useSoftwareReleases";
import { cn } from "@/lib/utils";

const db = supabase as any;

/**
 * The software version in production of a brand code: version, approval date
 * and checksum, never the file. Testing and release are done in R&D.
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
  if (!partId) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">Software</span>
      {!codes.length ? <p className="text-sm text-muted-foreground">{isModel ? "No brand codes yet." : "—"}</p>
        : isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : codes.map((c: any) => {
          const s = sw?.get(c.id);
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                {isModel && <span className="block font-mono text-xs text-muted-foreground">{c.part_code}</span>}
                {s ? (
                  <>
                    <span className="block font-mono font-medium">v{s.version}</span>
                    <span className="block text-xs text-muted-foreground" title={s.sha256 ?? ""}>approved {fmtDay(s.activated_at)}{s.sha256 ? ` · ${shortSum(s.sha256)}` : ""}</span>
                  </>
                ) : <span className={cn("block text-destructive")}>No approved software</span>}
              </span>
            </div>
          );
        })}
      <p className="text-xs text-muted-foreground">Files are kept in R&amp;D.</p>
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
      <span className="ml-1 text-xs font-normal text-muted-foreground" title={s.sha256 ?? ""}>approved {fmtDay(s.activated_at)}{s.sha256 ? ` · ${shortSum(s.sha256)}` : ""}</span>
    </p>
  ) : <p className="font-medium text-destructive">No approved software. Check with R&amp;D before loading.</p>;
}
