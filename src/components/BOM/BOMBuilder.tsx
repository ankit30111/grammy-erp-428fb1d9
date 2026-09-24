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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Loader2, Save, Search, X } from "lucide-react";
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
export const BOMBuilder = ({ initialParentId }: { initialParentId?: string } = {}) => {
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
  const [parentOpen, setParentOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [onlySelected, setOnlySelected] = useState(false);

  /** child part id -> quantity typed, as a string so a half-typed "0." survives */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [critical, setCritical] = useState<Record<string, boolean>>({});

  const parentPart = parts.find((p: any) => p.id === parentId);

  const parentCandidates = useMemo(
    () => parts.filter((p: any) => p.is_active !== false && MADE_HERE.includes(p.source_type ?? "PURCHASED")),
    [parts],
  );

  // What the bill is now, as the page's starting state. Keyed by child part so a
  // part unticked and ticked again is the same line, not a new one.
  const pendingRequest = requests.find((q) => q.parent_part_id === parentId && q.status === "PENDING");
  const rejectedRequest = !pendingRequest
    ? requests.find((q) => q.parent_part_id === parentId && q.status === "REJECTED")
    : undefined;

  const existing = useMemo(() => {
    const map: Record<string, { quantity: string; is_critical: boolean }> = {};
    // R&D reopening a part carries on from the change they already sent, not
    // from the live BOM - otherwise saving again would quietly undo it.
    if (needsApproval && pendingRequest) {
      for (const l of pendingRequest.lines) {
        map[l.child_part_id] = { quantity: String(l.quantity), is_critical: Boolean(l.is_critical) };
      }
      return map;
    }
    for (const line of lines as any[]) {
      if (line.parent_part_id === parentId) {
        map[line.child_part_id] = {
          quantity: String(line.quantity ?? 0),
          is_critical: Boolean(line.is_critical),
        };
      }
    }
    return map;
  }, [lines, parentId, needsApproval, pendingRequest]);

  // Reset the ticks only when the part changes or the saved BOM itself changes.
  // This used to run on every refetch of the BOM lines - which React Query does
  // whenever the window regains focus - so ticks made, then a switch to another
  // window, and they were silently back to the saved BOM before Save.
  const existingKey = useMemo(() => JSON.stringify(existing), [existing]);
  useEffect(() => {
    setPicked(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v.quantity])));
    setCritical(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v.is_critical])));
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
        Number(picked[id]) !== Number(existing[id]?.quantity ?? NaN) ||
        Boolean(critical[id]) !== Boolean(existing[id]?.is_critical),
    );
  }, [picked, critical, existing]);

  const handleSave = async () => {
    if (!parentId) return toast.error("Choose the part this bill of materials belongs to");

    const bad = Object.entries(picked).filter(([, q]) => !(Number(q) > 0));
    if (bad.length) {
      const codes = bad
        .map(([id]) => parts.find((p: any) => p.id === id)?.part_code)
        .filter(Boolean)
        .join(", ");
      // Named, not counted: "3 lines have no quantity" leaves you hunting.
      return toast.error(`Quantity must be more than zero — check ${codes}`);
    }

    await saveBom.mutateAsync({
      parent_part_id: parentId,
      lines: Object.entries(picked).map(([child_part_id, quantity]) => ({
        child_part_id,
        quantity: Number(quantity),
        uom: parts.find((p: any) => p.id === child_part_id)?.uom || "PCS",
        is_critical: Boolean(critical[child_part_id]),
      })),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label>Which part is this bill of materials for?</Label>
            <Popover open={parentOpen} onOpenChange={setParentOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between md:w-[520px]">
                  {parentPart
                    ? `${parentPart.part_code} — ${parentPart.name}`
                    : isLoading
                      ? "Loading parts..."
                      : "Select a sub-assembled or finished good..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by code or name..." />
                  <CommandList>
                    <CommandEmpty>
                      Nothing to choose yet — create a sub-assembled or finished good first.
                    </CommandEmpty>
                    <CommandGroup>
                      {parentCandidates.map((p: any) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.part_code} ${p.name}`}
                          onSelect={() => { setParentId(p.id); setParentOpen(false); }}
                        >
                          <span className="font-mono text-xs mr-2">{p.part_code}</span>
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Only parts Grammy builds — sub-assemblies and finished goods. A purchased
              part is bought as it is, so it has nothing to break down into.
            </p>
          </div>
        </CardContent>
      </Card>

      {parentId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                What goes into {parentPart?.part_code}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selectedCount} part{selectedCount === 1 ? "" : "s"} selected
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
                {canEditMasters && (
                  <Button onClick={handleSave} disabled={!dirty || saveBom.isPending}>
                    {saveBom.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                      : <><Save className="h-4 w-4 mr-2" />{needsApproval ? "Send for Approval" : "Save Bill of Materials"}</>}
                  </Button>
                )}
              </div>
            </div>
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
                    <TableHead className="w-36">QPS</TableHead>
                    <TableHead className="w-20">Critical</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {onlySelected
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
                            <Input
                              type="number"
                              min="0"
                              step="0.0001"
                              className="h-8"
                              disabled={!on}
                              value={on ? picked[p.id] : ""}
                              onChange={(e) =>
                                setPicked((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
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
              QPS is the quantity of that part in one set of {parentPart?.part_code}. Unticking a part removes it from
              the bill when you save.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
