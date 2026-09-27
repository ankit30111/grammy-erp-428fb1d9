import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Stamp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBrands } from "@/hooks/usePartCategories";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

export interface BrandIssue {
  id: number;
  part_id: string | null;
  part_code: string | null;
  kind: string;
  brand: string | null;
  message: string;
}

/** What the last branding sync could not do. Empty when everything lines up. */
export const useBrandIssues = () =>
  useQuery({
    queryKey: ["brand-sync-issues"],
    queryFn: async (): Promise<BrandIssue[]> => {
      const { data, error } = await (supabase as any)
        .from("brand_sync_issues").select("id, part_id, part_code, kind, brand, message").order("part_code");
      if (error) throw error;
      return data ?? [];
    },
  });

const usePartBrands = (partId?: string) =>
  useQuery({
    queryKey: ["part-brands", partId],
    enabled: !!partId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).from("part_brands").select("brand").eq("part_id", partId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.brand);
    },
  });

/**
 * Branding on a part.
 *
 *   Printed part (P-423):     [✓] Branding  → pick brands → P-423-CR, P-423-PH are made
 *   Contains a printed part:  shown as "built per brand", versions made automatically
 *   Brand version (P-423-CR): read-only, points back to its base part
 */
export const PartBranding = ({ part: given, allParts, editable = false }: {
  part: any; allParts: any[]; editable?: boolean;
}) => {
  // The dialog may hold an older copy; the list is refreshed after saving.
  const part = allParts.find((p) => p.id === given?.id) ?? given;
  const qc = useQueryClient();
  const { canApprove } = usePermissions();
  const { brands } = useBrands();
  const { data: saved = [], isSuccess } = usePartBrands(part?.id);
  const { data: issues = [] } = useBrandIssues();

  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    setOn(!!part?.branding_required);
    setPicked(saved);
  }, [part?.id, part?.branding_required, isSuccess, saved.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const versions = useMemo(
    () => allParts.filter((p) => p.branded_from === part?.id).sort((a, b) => a.part_code.localeCompare(b.part_code)),
    [allParts, part?.id],
  );
  const base = part?.branded_from ? allParts.find((p) => p.id === part.branded_from) : null;
  const brandName = (l: string) => brands.find((b) => b.letter === l)?.name ?? l;
  const myIssues = issues.filter((i) => i.part_id === part?.id);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("set_part_branding", {
        p_part_id: part.id, p_required: on, p_brands: on ? picked : [],
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      for (const k of ["parts", "raw-materials", "part-brands", "brand-sync-issues", "bom", "subassembly-positions"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      toast.success(
        on ? `Branding saved${d?.created ? ` · ${d.created} brand version${d.created === 1 ? "" : "s"} created` : ""}`
           : "Branding removed",
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save branding"),
  });

  if (!part || part.source_type === "FINISHED_GOOD") return null;

  // A brand version: nothing to set here.
  if (part.branded_from) {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Stamp className="h-4 w-4" /> {brandName(part.brand)} version of{" "}
          <span className="font-mono">{base?.part_code ?? "its base part"}</span>
        </div>
        <p className="text-muted-foreground">
          Made and kept by the system. It can only go into {brandName(part.brand)} products.
          To change its BOM or brands, change <span className="font-mono">{base?.part_code}</span>.
        </p>
      </div>
    );
  }

  const dirty = on !== !!part.branding_required || [...picked].sort().join() !== [...saved].sort().join();
  const canEdit = editable && canApprove;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2"><Stamp className="h-4 w-4" /> Branding</Label>
        {part.brand_relevant && !part.branding_required && (
          <Badge variant="outline">Built per brand</Badge>
        )}
      </div>

      {canEdit ? (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={on} onCheckedChange={(v) => setOn(Boolean(v))} />
          <span>Printed with the brand in-house before use. A separate code is kept for each brand.</span>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          {part.branding_required
            ? "Printed per brand in-house."
            : part.brand_relevant
              ? "Contains a printed part, so it is built per brand. Its brand versions are made automatically."
              : "Not printed per brand."}
        </p>
      )}

      {canEdit && on && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Brands</div>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => {
              const sel = picked.includes(b.letter);
              return (
                <Button key={b.letter} type="button" size="sm" variant={sel ? "default" : "outline"}
                        onClick={() => setPicked((p) => (sel ? p.filter((x) => x !== b.letter) : [...p, b.letter]))}>
                  <span className="font-mono">{b.letter}</span> {b.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Brand versions</div>
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => (
              <Badge key={v.id} variant={v.is_active ? "secondary" : "outline"}
                     className={cn("font-mono", !v.is_active && "line-through opacity-60")}>
                {v.part_code}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {myIssues.map((i) => (
        <p key={i.id} className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {i.message}
        </p>
      ))}

      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!dirty || save.isPending || (on && picked.length === 0)}
                  onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save branding"}
          </Button>
        </div>
      )}
    </div>
  );
};

/** The Parts page banner: anything branding could not line up. */
export const BrandIssuesBanner = () => {
  const { data: issues = [] } = useBrandIssues();
  if (issues.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" /> Branding needs attention ({issues.length})
      </div>
      <ul className="text-sm space-y-0.5">
        {issues.map((i) => <li key={i.id}>{i.message}</li>)}
      </ul>
    </div>
  );
};
