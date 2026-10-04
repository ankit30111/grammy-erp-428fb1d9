import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Search, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useParts } from "@/hooks/useParts";
import { usePartCategories, PART_TIERS } from "@/hooks/usePartCategories";
import { useBomLines, useBomMutations, useBomChangeRequests } from "@/hooks/useBOM";

const MADE_HERE = ["ASSEMBLED_INLINE", "ASSEMBLED_STOCKED", "FINISHED_GOOD"];

/**
 * A bill of materials built on one page.
 *
 * The first version added one line at a time: pick a part, type a quantity,
 * press Add, repeat. Correct, and unusable - a soundbar has sixty lines, so that
 * is sixty round trips and sixty chances to be interrupted halfway and leave a
 * half-built bill that looks finished.
 *
 * Here the whole list is in front of you: search and filter it, tick what goes
 * in, put the per-unit quantity beside each tick, and save once. What is already
 * on the bill comes back ticked with its quantity, so the same page edits an
 * existing bill rather than being a separate screen with its own rules.
 */
/**
 * Edits the bill of materials of ONE part. It is opened only from that part
 * (View / Edit -> Edit Bill of Materials) and cannot be switched to another
 * part, so nobody lands on a BOM by accident. Saving shows exactly what will
 * change and asks to confirm.
 */
/**
 * The same page edits a model version's draft BOM (Models page): pass `draft`.
 * Its lines are base parts - a brand's printed version is swapped in on the
 * brand code - and it is saved by the caller, not into bom.
 */
export interface BomDraft {
  title: string;
  lines: { child_part_id: string; quantity: number | null; bulk: boolean; is_critical: boolean }[];
  onSave: (lines: { child_part_id: string; quantity: number | null; bulk: boolean; is_critical: boolean }[]) => Promise<unknown>;
  saving?: boolean;
}

export const BOMBuilder = ({ partId: initialParentId, onClose, draft }: { partId: string; onClose?: () => void; draft?: BomDraft }) => {
  const { parts, isLoading } = useParts();
  const { categories } = usePartCategories();
  const { data: lines = [] } = useBomLines();
  const { saveBom } = useBomMutations();
  const { canEditMasters, needsApproval } = usePermissions();
  const { data: requests = [] } = useBomChangeRequests();

  const [parentId, setParentId] = useState(initialParentId ?? "");
  // Opened from a part's Edit or View: start on that part.
  useEffect(() => {
    if (initialParentId) setParentId(initialParentId);
  }, [initialParentId]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [onlySelected, setOnlySelected] = useState(false);

  /** child part id -> quantity typed, as a string so a half-typed "0." survives */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [critical, setCritical] = useState<Record<string, boolean>>({});
  /** Bulk lines (solder, flux): on the BOM, issued to the line from stock, no QPS. */
  const [bulk, setBulk] = useState<Record<string, boolean>>({});
  // A part has one unit (its consumed unit) and every BOM uses it.
  const stockQty = (id: string) => Number(picked[id]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parentPart = parts.find((p: any) => p.id === parentId);
  // Brand codes and sub-assemblies under R&D's version control: this BOM is
  // written from the released version, so a change belongs in an ECN.
  const { data: engVersion } = useQuery({
    queryKey: ["eng-production-of", parentId],
    enabled: !!parentId && !draft,
    queryFn: async () => {
      const p: any = parts.find((x: any) => x.id === parentId);
      const item = p?.source_type === "FINISHED_GOOD" ? p?.model_id : parentId;
      if (!item) return null;
      const { data } = await (supabase as any).from("item_versions").select("version, item:parts!item_versions_item_id_fkey ( part_code, plm:plm_products!parts_plm_product_id_fkey ( product_code ) )")
        .eq("item_id", item).eq("status", "RELEASED").order("major", { ascending: false }).order("minor", { ascending: false }).limit(1).maybeSingle();
      return data as { version: string; item: { part_code: string; plm: { product_code: string } | null } } | null;
    },
  });

  const parentCandidates = useMemo(
    // Brand versions are not offered: their BOM follows the base part's.
    () => parts.filter((p: any) => p.is_active !== false && !p.branded_from && MADE_HERE.includes(p.source_type ?? "PURCHASED")),
    [parts],
  );

  // What the bill is now, as the page's starting state. Keyed by child part so a
  // part unticked and ticked again is the same line, not a new one.
  const pendingRequest = draft ? undefined : requests.find((q) => q.parent_part_id === parentId && q.status === "PENDING");
  const rejectedRequest = !pendingRequest && !draft
    ? requests.find((q) => q.parent_part_id === parentId && q.status === "REJECTED")
    : undefined;

  const existing = useMemo(() => {
    const map: Record<string, { quantity: string; is_critical: boolean; bulk: boolean }> = {};
    if (draft) {
      for (const l of draft.lines) map[l.child_part_id] = { quantity: l.bulk ? "" : String(l.quantity ?? 0), is_critical: l.is_critical, bulk: l.bulk };
      return map;
    }
    // R&D reopening a part carries on from the change they already sent, not
    // from the live BOM - otherwise saving again would quietly undo it.
    if (needsApproval && pendingRequest) {
      for (const l of pendingRequest.lines) {
        map[l.child_part_id] = {
          quantity: (l as any).bulk ? "" : String(l.quantity),
          is_critical: Boolean(l.is_critical),
          bulk: Boolean((l as any).bulk),
        };
      }
      return map;
    }
    for (const line of lines as any[]) {
      if (line.parent_part_id === parentId) {
        map[line.child_part_id] = {
          quantity: line.issue_mode === "BULK" ? "" : String(line.quantity ?? 0),
          is_critical: Boolean(line.is_critical),
          bulk: line.issue_mode === "BULK",
        };
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, parentId, needsApproval, pendingRequest, draft?.lines]);

  // Reset the ticks only when the part changes or the saved BOM itself changes.
  // This used to run on every refetch of the BOM lines - which React Query does
  // whenever the window regains focus - so ticks made, then a switch to another
  // window, and they were silently back to the saved BOM before Save.
  const existingKey = useMemo(() => JSON.stringify(existing), [existing]);
  useEffect(() => {
    setPicked(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v.quantity])));
    setCritical(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v.is_critical])));
    setBulk(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v.bulk])));
    setOnlySelected(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, existingKey]);

  const categoryName = (prefix?: string | null) =>
    categories.find((c) => c.prefix === prefix)?.name ?? prefix ?? "";
  const tierOf = (prefix?: string | null) =>
    categories.find((c) => c.prefix === prefix)?.tier ?? "PURCHASE";

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts
      .filter((p: any) => {
        // A part cannot be inside itself, and the database refuses it anyway -
        // better to not offer it than to explain the refusal afterwards.
        if (p.id === parentId) return false;
        // A model holds base parts only: no brand versions, no finished goods.
        if (draft && (p.branded_from || p.source_type === "FINISHED_GOOD")) return false;
        // A deactivated part is not offered - unless it is already on this BOM,
        // so it can be seen and taken off.
        if (p.is_active === false && picked[p.id] === undefined) return false;
        if (onlySelected && picked[p.id] === undefined) return false;
        if (filterCategory !== "all" && p.category !== filterCategory) return false;
        if (filterType !== "all" && tierOf(p.category) !== filterType) return false;
        if (!q) return true;
        return (
          (p.part_code || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => (a.part_code || "").localeCompare(b.part_code || ""));
  }, [parts, parentId, search, filterCategory, filterType, onlySelected, picked, categories]);

  const toggle = (partId: string, on: boolean) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (on) next[partId] = prev[partId] ?? "1";
      else delete next[partId];
      return next;
    });
  };

  const selectedCount = Object.keys(picked).length;

  // Counted against what the bill was when the page loaded, so the Save button
  // can say whether there is anything to save at all.
  const dirty = useMemo(() => {
    const before = Object.keys(existing).sort().join("|");
    const after = Object.keys(picked).sort().join("|");
    if (before !== after) return true;
    return Object.keys(picked).some(
      (id) =>
        stockQty(id) !== Number(existing[id]?.quantity ?? NaN) ||
        Boolean(critical[id]) !== Boolean(existing[id]?.is_critical) ||
        Boolean(bulk[id]) !== Boolean(existing[id]?.bulk),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, critical, bulk, existing]);

  const partOf = (id: string) => parts.find((p: any) => p.id === id) as any;
  const fmtLine = (id: string, q: number | null, isBulk: boolean) =>
    isBulk ? "bulk" : `${q} ${(partOf(id)?.uom || "PCS").toUpperCase()}`;
  // Exactly what Save will do, line by line, for the confirmation.
  const changes = useMemo(() => {
    const added: string[] = [], removed: string[] = [], changed: string[] = [];
    for (const id of Object.keys(picked)) {
      const p = partOf(id); const code = p?.part_code ?? "?";
      const now = fmtLine(id, stockQty(id), Boolean(bulk[id]));
      const was = existing[id];
      if (!was) { added.push(`${code} ${p?.name ?? ""} — ${now}${critical[id] ? ", critical" : ""}`); continue; }
      const wasTxt = fmtLine(id, Number(was.quantity), Boolean(was.bulk));
      const bits: string[] = [];
      if (wasTxt !== now) bits.push(`${wasTxt} → ${now}`);
      if (Boolean(was.is_critical) !== Boolean(critical[id])) bits.push(critical[id] ? "now critical" : "no longer critical");
      if (bits.length) changed.push(`${code} ${p?.name ?? ""} — ${bits.join(", ")}`);
    }
    for (const id of Object.keys(existing)) {
      if (picked[id] === undefined) { const p = partOf(id); removed.push(`${p?.part_code ?? "?"} ${p?.name ?? ""}`); }
    }
    return { added, removed, changed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, critical, bulk, existing, parts]);
  const printedAdded = useMemo(() => {
    if (draft || (parentPart as any)?.source_type === "FINISHED_GOOD" || (parentPart as any)?.brand_relevant) return [];
    return Object.keys(picked).filter((id) => !existing[id]).map(partOf)
      .filter((p: any) => p && (p.branding_required || p.brand_relevant));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, existing, parentPart, parts]);

  const handleSave = async () => {
    if (!parentId) return;

    const bad = Object.entries(picked).filter(([id, q]) => !bulk[id] && !(Number(q) > 0));
    if (bad.length) {
      const codes = bad
        .map(([id]) => parts.find((p: any) => p.id === id)?.part_code)
        .filter(Boolean)
        .join(", ");
      // Named, not counted: "3 lines have no quantity" leaves you hunting.
      return toast.error(`Quantity must be more than zero — check ${codes}`);
    }

    setConfirmOpen(true);
  };

  const commitSave = async () => {
    setConfirmOpen(false);
    if (draft) {
      await draft.onSave(Object.keys(picked).map((child_part_id) => ({
        child_part_id,
        quantity: bulk[child_part_id] ? null : stockQty(child_part_id),
        bulk: Boolean(bulk[child_part_id]),
        is_critical: Boolean(critical[child_part_id]),
      })));
      return;
    }
    await saveBom.mutateAsync({
      parent_part_id: parentId,
      lines: Object.entries(picked).map(([child_part_id, quantity]) => ({
        child_part_id,
        quantity: bulk[child_part_id] ? null : stockQty(child_part_id),
        bulk: Boolean(bulk[child_part_id]),
        uom: parts.find((p: any) => p.id === child_part_id)?.uom || "PCS",
        is_critical: Boolean(critical[child_part_id]),
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {draft ? "Back" : "Back to parts"}
          </Button>
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill of Materials</div>
          <div className="font-medium truncate">
            {draft ? draft.title : parentPart ? <><span className="font-mono">{parentPart.part_code}</span> — {parentPart.name}</> : isLoading ? "Loading…" : "Part not found"}
          </div>
        </div>
      </div>

      {parentId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                What goes into {draft ? draft.title : parentPart?.part_code}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selectedCount} part{selectedCount === 1 ? "" : "s"} selected
                </span>
              </CardTitle>
              {(parentPart as any)?.brand_relevant && (
                <p className="basis-full text-xs text-muted-foreground">
                  This part is built per brand: its brand versions ({parts.filter((p: any) => p.branded_from === parentId && p.is_active).map((p: any) => p.part_code).join(", ") || "none yet"}) follow this BOM automatically.
                </p>
              )}
              {(parentPart as any)?.source_type === "FINISHED_GOOD" && (parentPart as any)?.brand && (
                <p className="basis-full text-xs text-muted-foreground">
                  Parts printed per brand are switched to their {(parentPart as any).brand} version when saved.
                </p>
              )}
              <div className="flex items-center gap-2">
                {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
                {canEditMasters && (
                  <Button onClick={handleSave} disabled={!dirty || saveBom.isPending || Boolean(draft?.saving)}>
                    {saveBom.isPending || draft?.saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                      : <><Save className="h-4 w-4 mr-2" />{draft ? "Save draft" : needsApproval ? "Send for Approval" : "Save Bill of Materials"}</>}
                  </Button>
                )}
              </div>
            </div>
            {engVersion && (
              <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                This BOM is built from R&amp;D's {engVersion.item.part_code} v{engVersion.version}. Change it there with an ECN
                {engVersion.item.plm ? <> (R&amp;D product {engVersion.item.plm.product_code}, BOM tab)</> : null}: a change saved here is
                replaced the next time a version is released onto it.
              </p>
            )}
            {pendingRequest && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                {needsApproval
                  ? `Your change sent on ${new Date(pendingRequest.submitted_at).toLocaleDateString()} is waiting for Management. You are editing that change; the BOM in use has not changed yet.`
                  : "A change from R&D is waiting in Approvals. You are looking at the BOM in use; saving here changes it directly."}
              </p>
            )}
            {rejectedRequest && needsApproval && (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                The last change sent for this BOM was rejected: {rejectedRequest.rejection_reason}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by part code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.prefix} value={c.prefix}>
                      {c.name} ({c.prefix})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PART_TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={onlySelected ? "default" : "outline"}
                onClick={() => setOnlySelected((v) => !v)}
                className="md:w-[160px]"
              >
                {onlySelected ? <X className="h-4 w-4 mr-2" /> : null}
                {onlySelected ? "Show all" : `Selected (${selectedCount})`}
              </Button>
            </div>

            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-32">Part Code</TableHead>
                    <TableHead>Part Name</TableHead>
                    <TableHead className="w-40">Category</TableHead>
                    <TableHead className="w-44">QPS</TableHead>
                    <TableHead className="w-20" title="Issued to the line from stock, not counted per set">Bulk</TableHead>
                    <TableHead className="w-20">Critical</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isLoading ? "Loading parts…" : onlySelected
                          ? "Nothing selected yet."
                          : "No parts match this search or filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((p: any) => {
                      const on = picked[p.id] !== undefined;
                      return (
                        <TableRow key={p.id} className={on ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => toggle(p.id, Boolean(v))}
                              aria-label={`Include ${p.part_code}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.part_code}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {categoryName(p.category)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="0.0001"
                                className="h-8"
                                disabled={!on || Boolean(bulk[p.id])}
                                placeholder={bulk[p.id] ? "bulk" : undefined}
                                value={on && !bulk[p.id] ? picked[p.id] : ""}
                                onChange={(e) =>
                                  setPicked((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                              />
                              {/* One unit per part - its consumed unit - in every BOM. */}
                              <span className="w-14 shrink-0 text-xs text-muted-foreground">{(p.uom || "PCS").toUpperCase()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={Boolean(bulk[p.id])}
                              disabled={!on}
                              onCheckedChange={(v) => setBulk((prev) => ({ ...prev, [p.id]: Boolean(v) }))}
                              aria-label={`Issue ${p.part_code} in bulk`}
                            />
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={Boolean(critical[p.id])}
                              disabled={!on}
                              onCheckedChange={(v) =>
                                setCritical((prev) => ({ ...prev, [p.id]: Boolean(v) }))
                              }
                              aria-label={`Mark ${p.part_code} critical`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              QPS is the quantity of that part in one set of {draft ? draft.title : parentPart?.part_code}. Unticking a part removes it from
              the bill when you save.
            </p>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {draft ? `Save the draft of ${draft.title}?` : needsApproval ? `Send the change to ${parentPart?.part_code} for approval?` : `Save the change to ${parentPart?.part_code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground">
                {[["Added", changes.added], ["Changed", changes.changed], ["Removed", changes.removed]].map(([label, list]) =>
                  (list as string[]).length > 0 && (
                    <div key={label as string}>
                      <div className="font-medium">{label as string} ({(list as string[]).length})</div>
                      <ul className="mt-1 max-h-40 overflow-y-auto list-disc pl-5 text-muted-foreground">
                        {(list as string[]).map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    </div>
                  ))}
                {printedAdded.length > 0 && (
                  <p className="rounded-md border border-warning/40 bg-warning/10 p-2">
                    {printedAdded.map((p: any) => p.part_code).join(", ")} {printedAdded.length === 1 ? "is" : "are"} printed per brand.
                    Adding {printedAdded.length === 1 ? "it" : "them"} makes {parentPart?.part_code} built per brand: every finished good
                    using it will need {printedAdded.length === 1 ? "this part" : "these parts"} printed for its own brand before it can be scheduled.
                  </p>
                )}
                {needsApproval && !draft && <p className="text-muted-foreground">Management approves it before the BOM in use changes.</p>}
                {draft && <p className="text-muted-foreground">Nothing in production changes: brands move to this version only when it is released and Management moves them.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void commitSave()}>
              {needsApproval && !draft ? "Send for approval" : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
