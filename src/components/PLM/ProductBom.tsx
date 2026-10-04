import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty } from "@/components/ui/table-state";
import { cn } from "@/lib/utils";

const sel = "h-8 rounded-md border border-input bg-background px-2 text-sm";
const CHANGE_LABEL: Record<string, string> = { NEW: "new", CARRY_OVER: "carry-over", CHANGED: "changed" };

export type PickPart = { id: string; part_code: string; name: string; uom: string | null; category: string; branding_required?: boolean; brand_relevant?: boolean };

/** Every part that can go into a BOM (not finished goods, not brand versions), for pickers. */
export const usePickParts = () =>
  useQuery({
    queryKey: ["plm-pick-parts"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: PickPart[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from("parts")
          .select("id, part_code, name, uom, category, branding_required, brand_relevant")
          .eq("is_active", true).not("source_type", "in", "(FINISHED_GOOD,MODEL)").is("branded_from", null)
          .order("part_code").range(from, from + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });

/** Text box with the part list as suggestions; resolves "B-121 — EPS" to the part. */
export function PartPicker({ parts, value, onPick, placeholder, id }: {
  parts: PickPart[]; value?: string; onPick: (p: PickPart | null, text: string) => void; placeholder?: string; id: string;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <>
      <Input id={id} list={`${id}-list`} className="h-8" placeholder={placeholder ?? "Part code or name"} value={text}
             onChange={(e) => {
               setText(e.target.value);
               const code = e.target.value.split(" — ")[0].trim().toUpperCase();
               onPick(parts.find((p) => p.part_code === code) ?? null, e.target.value);
             }} />
      <datalist id={`${id}-list`}>
        {text.length >= 1 && parts.filter((p) => `${p.part_code} ${p.name}`.toLowerCase().includes(text.toLowerCase().split(" — ")[0]))
          .slice(0, 60).map((p) => <option key={p.id} value={`${p.part_code} — ${p.name}`} />)}
      </datalist>
    </>
  );
}

/** Suggested changes when a product is made for another brand. */
const likelyChange = (p?: PickPart | null) =>
  !!p && (p.category === "B" || p.category === "S" || !!p.branding_required || !!p.brand_relevant || /logo|manual|qsg|gift box|carton/i.test(p.name));

/**
 * A variation's first BOM: the base product's BOM, each line Keep / Change / Remove.
 * Brand-related lines (packaging, stickers, printed parts, logo, manual) are
 * pre-marked Change.
 */
/** A line of the BOM a variation starts from. */
export type BaseLine = { id: string; part_id: string | null; description: string | null; quantity: number | null; bulk: boolean;
  part: { part_code: string; name: string } | null };

export function BaseBomPicker({ baseLines, baseCode, onSubmit, busy }: {
  baseLines: BaseLine[]; baseCode: string; onSubmit: (actions: any[]) => void; busy?: boolean;
}) {
  const { data: parts = [] } = usePickParts();
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const [act, setAct] = useState<Record<string, { action: string; part_id?: string; description?: string }>>({});
  const get = (l: BaseLine) => act[l.id] ?? { action: likelyChange(byId.get(l.part_id ?? "")) ? "CHANGE" : "KEEP" };
  const set = (id: string, v: any) => setAct((a) => ({ ...a, [id]: { ...(a[id] ?? get(baseLines.find((x) => x.id === id)!)), ...v } }));
  const counts = baseLines.reduce((c, l) => ({ ...c, [get(l).action]: (c[get(l).action] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {baseCode}'s BOM, line by line. Keep what stays the same (carry-over, already released). Mark what changes for this
        product: pick the replacement part if it exists, or leave it blank and a new-part line is made for R&amp;D to develop.
        Packaging, stickers, printed parts, logo and manual are marked Change to start with.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Part in {baseCode}</TableHead><TableHead className="text-right">QPS</TableHead>
            <TableHead>Keep / Change / Remove</TableHead><TableHead>Replacement (optional)</TableHead></TableRow></TableHeader>
          <TableBody>
            {baseLines.map((l) => {
              const a = get(l);
              return (
                <TableRow key={l.id} className={cn(a.action === "CHANGE" && "bg-warning/5", a.action === "REMOVE" && "opacity-50")}>
                  <TableCell className="min-w-[220px]">{l.part ? <><span className="font-mono text-sm">{l.part.part_code}</span> {l.part.name}</> : <i>{l.description}</i>}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.bulk ? "bulk" : l.quantity}</TableCell>
                  <TableCell>
                    <div className="flex gap-3 text-sm">
                      {[["KEEP", "Keep"], ["CHANGE", "Change"], ["REMOVE", "Remove"]].map(([v, t]) => (
                        <label key={v} className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" name={`act-${l.id}`} checked={a.action === v} onChange={() => set(l.id, { action: v })} /> {t}
                        </label>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[240px]">
                    {a.action === "CHANGE" && (
                      <PartPicker id={`rep-${l.id}`} parts={parts} placeholder="Existing part, or describe the new one"
                                  onPick={(p, t) => set(l.id, { part_id: p?.id ?? "", description: p ? "" : t })} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Keep {counts.KEEP ?? 0} · Change {counts.CHANGE ?? 0} · Remove {counts.REMOVE ?? 0}</span>
        <Button className="ml-auto" disabled={busy}
                onClick={() => onSubmit(baseLines.map((l) => ({ line_id: l.id, ...get(l) })))}>
          <Upload className="h-4 w-4" /> Create this product's BOM
        </Button>
      </div>
    </div>
  );
}
