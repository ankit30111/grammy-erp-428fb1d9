import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useBrands } from "@/hooks/usePartCategories";
import { type Stored, erpValues, filled, useCrsData } from "@/hooks/useCrs";
import { cn } from "@/lib/utils";
import { downloadBytes, ddmmyyyy } from "@/lib/xlsxLite";
import {
  CRS_LISTS, CRS_REVISION, CRS_TEMPLATE_URL, CRS_TYPES, type CrsField, type CrsType, type CrsValue,
  buildCrsWorkbook, crsFieldsFor, crsTypeForCategory,
} from "@/lib/crs/crsExport";

const db = supabase as any;
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
export function CrsTab({ data, canEdit }: { data: any; canEdit: boolean }) {
  const p = data.product;
  const qc = useQueryClient();
  const { userProfile } = useAuth() as any;
  const { brands } = useBrands();
  const { data: crs, isLoading } = useCrsData(p.id);
  const [filter, setFilter] = useState<"all" | "mandatory" | "empty">("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const type: CrsType | null = crs?.type ?? crsTypeForCategory(p.category);
  const fields = useMemo(() => (type ? crsFieldsFor(type) : []), [type]);
  const stored = crs?.values ?? {};
  const auto = useMemo(
    () => (type ? erpValues(data, type, (l) => brands.find((b) => b.letter === l)?.name, userProfile?.full_name ?? "") : {}),
    [data, type, brands, userProfile?.full_name],
  );
  const effective = (id: string): CrsValue => ({
    value: filled(stored[id]) ? stored[id].value : auto[id]?.value ?? "",
    remarks: stored[id]?.remarks?.trim() ? stored[id].remarks : auto[id]?.remarks ?? "",
  });

  const setType = useMutation({
    mutationFn: async (t: CrsType) => {
      const { error } = await db.from("plm_crs").upsert({ product_id: p.id, crs_type: t });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plm-crs", p.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async ({ id, value, remarks }: { id: string; value: string; remarks: string }) => {
      if (!crs?.type && type) {
        const { error } = await db.from("plm_crs").upsert({ product_id: p.id, crs_type: type });
        if (error) throw error;
      }
      const res = !value.trim() && !remarks.trim()
        ? await db.from("plm_crs_values").delete().eq("product_id", p.id).eq("field_id", id)
        : await db.from("plm_crs_values").upsert({ product_id: p.id, field_id: id, value: value.trim() || null, remarks: remarks.trim() || null });
      if (res.error) throw res.error;
    },
    onMutate: ({ id, value, remarks }) => {
      qc.setQueryData(["plm-crs", p.id], (old: any) => old && ({ ...old, values: { ...old.values, [id]: { value, remarks } } }));
    },
    onError: (e: any) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["plm-crs", p.id] }); },
  });

  const mandatory = fields.filter((f) => f.mandatory);
  const mandatoryDone = mandatory.filter((f) => filled(effective(f.id))).length;
  const done = fields.filter((f) => filled(effective(f.id))).length;

  const shown = fields.filter((f) => {
    if (filter === "mandatory" && !f.mandatory) return false;
    if (filter === "empty" && filled(effective(f.id))) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      return f.parameter.toLowerCase().includes(s) || f.id.toLowerCase().includes(s) || f.section.toLowerCase().includes(s);
    }
    return true;
  });
  const sections = [...new Set(shown.map((f) => f.section))];

  const exportCrs = async () => {
    if (!type) return;
    setBusy(true);
    try {
      const res = await fetch(CRS_TEMPLATE_URL);
      if (!res.ok) throw new Error("Could not load the CRS template");
      const values: Stored = {};
      for (const f of fields) values[f.id] = effective(f.id);
      const bytes = buildCrsWorkbook(new Uint8Array(await res.arrayBuffer()), type, values);
      downloadBytes(bytes, `CRS ${p.product_code} ${type} ${ddmmyyyy()}.xlsx`);
      const missing = mandatory.length - mandatoryDone;
      if (missing > 0) toast.warning(`Exported. ${missing} mandatory field${missing === 1 ? " is" : "s are"} still empty.`);
      else toast.success("CRS exported");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">CRS sheet</div>
            <select className={cn(sel, "w-48")} value={type ?? ""} disabled={!canEdit || setType.isPending}
                    onChange={(e) => e.target.value && setType.mutate(e.target.value as CrsType)}>
              {!type && <option value="">Choose…</option>}
              {CRS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {type && (
            <div className="text-sm">
              <div><span className="font-semibold tabular-nums">{mandatoryDone}/{mandatory.length}</span> mandatory filled</div>
              <div className="text-xs text-muted-foreground tabular-nums">{done} of {fields.length} fields · GA/QMS/RND/DOC/044 {CRS_REVISION}</div>
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {type && (
              <>
                <div className="flex rounded-md border p-0.5 text-sm">
                  {([["all", "All"], ["mandatory", "Mandatory"], ["empty", "Not filled"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFilter(k)}
                            className={cn("rounded px-2.5 py-1", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
                  ))}
                </div>
                <Input className="h-9 w-48" placeholder="Search fields" value={q} onChange={(e) => setQ(e.target.value)} />
              </>
            )}
            <Button onClick={exportCrs} disabled={!type || busy}><Download className="h-4 w-4" /> {busy ? "Exporting…" : "Export CRS"}</Button>
          </div>
        </div>

        {!type && (
          <p className="text-sm text-muted-foreground">
            The category “{p.category ?? "none"}” has no CRS sheet. Choose the sheet this product follows.
          </p>
        )}

        {type && sections.length === 0 && <p className="text-sm text-muted-foreground">No fields match.</p>}

        {type && sections.map((s) => {
          const rows = shown.filter((f) => f.section === s);
          const all = fields.filter((f) => f.section === s);
          return (
            <section key={s} className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <h3 className="text-sm font-semibold">{s}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{all.filter((f) => filled(effective(f.id))).length}/{all.length}</span>
              </div>
              <div className="divide-y">
                {rows.map((f) => (
                  <CrsRow key={f.id} field={f} stored={stored[f.id]} auto={auto[f.id]} disabled={!canEdit}
                          onSave={(value, remarks) => save.mutate({ id: f.id, value, remarks })} />
                ))}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CrsRow({ field: f, stored, auto, disabled, onSave }: {
  field: CrsField; stored?: CrsValue; auto?: CrsValue; disabled: boolean; onSave: (value: string, remarks: string) => void;
}) {
  const value = stored?.value ?? "";
  const remarks = stored?.remarks ?? "";
  const commit = (v: string, r: string) => { if (v.trim() !== value.trim() || r.trim() !== remarks.trim()) onSave(v, r); };
  const autoValue = !value.trim() ? auto?.value ?? "" : "";
  const options = f.pick ? CRS_LISTS[f.pick] ?? [] : [];
  const unit = f.unit || (f.type !== "List" && f.pick ? f.pick : "");

  let control: JSX.Element;
  if (f.type === "List" && options.length) {
    control = (
      <select className={cn(sel, !value && autoValue && "text-muted-foreground")} disabled={disabled}
              value={value} onChange={(e) => commit(e.target.value, remarks)}>
        <option value="">{autoValue ? `${autoValue} (from ERP)` : "—"}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
      </select>
    );
  } else if (f.type === "Date") {
    control = (
      <Input type="date" key={value} defaultValue={value || ""} disabled={disabled}
             onBlur={(e) => commit(e.target.value, remarks)} />
    );
  } else {
    control = (
      <div className="relative">
        <Input key={value} defaultValue={value} disabled={disabled}
               inputMode={f.type === "Integer" || f.type === "Number" ? "decimal" : undefined}
               placeholder={autoValue ? `${autoValue} (from ERP)` : ""}
               className={cn(unit && "pr-12")}
               onBlur={(e) => commit(e.target.value, remarks)} />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{unit}</span>}
      </div>
    );
  }

  return (
    <div className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)] md:items-start">
      <div className="min-w-0">
        <div className="text-sm">
          {f.parameter}{f.mandatory && <span className="text-destructive" title="Mandatory"> *</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{f.id}</span>
          {f.condition && <> · {f.condition}</>}
          {f.requiredBy && f.requiredBy !== "Both" && <> · {f.requiredBy}</>}
        </div>
      </div>
      <div>
        {control}
        {f.type === "Date" && autoValue && <div className="mt-1 text-xs text-muted-foreground">From ERP: {autoValue.split("-").reverse().join("-")}</div>}
      </div>
      <Input key={`r${remarks}`} defaultValue={remarks} disabled={disabled} placeholder={auto?.remarks && !remarks ? auto.remarks : "Remarks"}
             onBlur={(e) => commit(value, e.target.value)} />
    </div>
  );
}
