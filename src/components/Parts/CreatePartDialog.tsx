import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus, ShoppingCart, Wrench, Layers, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useParts, PART_SOURCE_TYPES, type PartSourceType } from "@/hooks/useParts";
import { usePartCategories, issuePartCode } from "@/hooks/usePartCategories";
import { useVendors } from "@/hooks/useVendors";

const UNIT_OPTIONS = ["PCS", "KG", "METER", "LITER", "SET", "PACK", "ROLL", "SHEET", "BOX"];

/**
 * One dialog, four forms.
 *
 * The old screen had a single "Add Raw Material" form that asked every part for a
 * vendor, a currency and a landed price - questions that have no answer for
 * something Grammy builds itself. So the kind of part is chosen first and the
 * form is only the fields that kind actually has.
 *
 * What each kind is, in the ledger's terms, because the difference is not
 * cosmetic - it decides whether the part ever holds stock of its own:
 *
 *   Purchase part      bought as it is; has vendors and a price
 *   Semi-finished      built on the line and consumed there; never stocked, so
 *                      its bill of materials explodes straight through to raw
 *                      material when production is planned
 *   Sub-assembled      built here, put into the store, issued again later; holds
 *                      its own stock balance and is planned in its own right
 *   Finished good      dispatched, serialised, invoiced
 */
const KINDS: {
  value: PartSourceType;
  label: string;
  blurb: string;
  icon: typeof ShoppingCart;
}[] = [
  {
    value: "PURCHASED",
    label: "Purchase Part",
    blurb: "Bought from a vendor as it is",
    icon: ShoppingCart,
  },
  {
    value: "ASSEMBLED_INLINE",
    label: "Semi-finished Good",
    blurb: "Built on the line and used there — never stocked",
    icon: Wrench,
  },
  {
    value: "ASSEMBLED_STOCKED",
    label: "Sub-assembled Good",
    blurb: "Built here, stored, and issued again later",
    icon: Layers,
  },
  {
    value: "FINISHED_GOOD",
    label: "Finished Good",
    blurb: "What gets packed and dispatched",
    icon: Package,
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePartDialog = ({ open, onOpenChange }: Props) => {
  const { addPart } = useParts();
  const { categories, freePrefixes, addCategory } = usePartCategories();
  const { vendors = [] } = useVendors();

  const [kind, setKind] = useState<PartSourceType | null>(null);
  const [categoryPrefix, setCategoryPrefix] = useState("");
  const [partCode, setPartCode] = useState("");
  const [issuing, setIssuing] = useState(false);

  const [name, setName] = useState("");
  const [uom, setUom] = useState("PCS");
  const [specification, setSpecification] = useState("");

  // Purchase-only
  const [sourcingType, setSourcingType] = useState<"LOCAL" | "IMPORTED">("LOCAL");
  const [currency, setCurrency] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [cbm, setCbm] = useState("");
  const [supplierCountry, setSupplierCountry] = useState("");
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [primaryVendor, setPrimaryVendor] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);

  // New-category-in-line
  const [addingCategory, setAddingCategory] = useState(false);
  const [newPrefix, setNewPrefix] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [saving, setSaving] = useState(false);

  const kindMeta = KINDS.find((k) => k.value === kind);
  const isPurchase = kind === "PURCHASED";

  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );

  const reset = () => {
    setKind(null); setCategoryPrefix(""); setPartCode("");
    setName(""); setUom("PCS"); setSpecification("");
    setSourcingType("LOCAL"); setCurrency(""); setUnitPrice(""); setCbm("");
    setSupplierCountry(""); setSelectedVendors([]); setPrimaryVendor("");
    setAddingCategory(false); setNewPrefix(""); setNewCategoryName("");
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Changing the kind invalidates the category, and the category is what the code
  // is issued against - so the code has to go with it rather than being carried
  // over from a category that no longer applies.
  useEffect(() => {
    setCategoryPrefix("");
    setPartCode("");
  }, [kind]);

  const chooseCategory = async (prefix: string) => {
    setCategoryPrefix(prefix);
    setPartCode("");
    setIssuing(true);
    try {
      setPartCode(await issuePartCode(prefix));
    } catch (error: any) {
      // The reason is shown. A code that could not be issued is not a thing to
      // retry blindly - usually the letter has been deactivated.
      toast.error(error?.message || "Could not issue a part code");
      setCategoryPrefix("");
    } finally {
      setIssuing(false);
    }
  };

  const handleAddCategory = async () => {
    if (!/^[A-Z]{1,2}$/.test(newPrefix.toUpperCase())) {
      toast.error("A prefix is one or two letters");
      return;
    }
    if (!newCategoryName.trim()) {
      toast.error("Give the category a name");
      return;
    }
    await addCategory.mutateAsync({
      prefix: newPrefix.toUpperCase(),
      name: newCategoryName,
      kind: kind!,
    });
    setAddingCategory(false);
    setNewCategoryName("");
    const created = newPrefix.toUpperCase();
    setNewPrefix("");
    await chooseCategory(created);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Part name is required");
    if (!categoryPrefix) return toast.error("Choose a category");
    if (!partCode) return toast.error("No part code was issued — choose the category again");

    setSaving(true);
    try {
      await addPart.mutateAsync({
        name: name.trim(),
        part_code: partCode,
        category: categoryPrefix,
        uom,
        // The database reads the kind off the category and overwrites this, so
        // the two can never disagree. It is sent anyway so the intent is on the
        // wire and a mismatch would be visible rather than silent.
        source_type: kind!,
        specification: specification.trim() || undefined,
        ...(isPurchase
          ? {
              sourcing_type: sourcingType,
              currency: sourcingType === "IMPORTED" ? currency || undefined : undefined,
              unit_price: unitPrice ? parseFloat(unitPrice) : undefined,
              cbm_per_unit: cbm ? parseFloat(cbm) : undefined,
              supplier_country:
                sourcingType === "IMPORTED" ? supplierCountry || undefined : undefined,
              vendorIds: selectedVendors,
              primaryVendorId: primaryVendor,
            }
          : {}),
      });
      onOpenChange(false);
    } catch {
      // addPart raises its own toast with the database's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Part Code</DialogTitle>
          <DialogDescription>
            Every part code comes from the same directory, so a letter can only ever mean one thing.
          </DialogDescription>
        </DialogHeader>

        {/* ---- 1. what kind of part ---------------------------------------- */}
        <div className="space-y-2">
          <Label>What kind of part is this?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {KINDS.map((k) => {
              const Icon = k.icon;
              const active = kind === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "text-left rounded-lg border p-3 transition-colors",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4 shrink-0" />
                    {k.label}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{k.blurb}</p>
                </button>
              );
            })}
          </div>
        </div>

        {kind && (
          <div className="space-y-4 border-t pt-4">
            {/* ---- 2. category and the code it issues ----------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={categoryPrefix} onValueChange={chooseCategory}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        kindCategories.length === 0
                          ? "No category yet for this kind"
                          : "Select category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {kindCategories.map((c) => (
                      <SelectItem key={c.prefix} value={c.prefix}>
                        {c.name} ({c.prefix}-xxx)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAddingCategory((v) => !v)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New category for {kindMeta?.label.toLowerCase()}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Part Code</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                  {issuing ? (
                    <span className="flex items-center text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Issuing…
                    </span>
                  ) : partCode ? (
                    partCode
                  ) : (
                    <span className="text-muted-foreground">Choose a category</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Issued by the system, so two people creating a part at once cannot get the same code.
                </p>
              </div>
            </div>

            {addingCategory && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Letter</Label>
                    <Select value={newPrefix} onValueChange={setNewPrefix}>
                      <SelectTrigger><SelectValue placeholder="Free letters" /></SelectTrigger>
                      <SelectContent>
                        {freePrefixes.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Category name</Label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Soundbar"
                    />
                  </div>
                </div>
                {/* Only the letters nothing else holds are offered, so a new
                    category cannot be given a letter that already means gaskets. */}
                <p className="text-xs text-muted-foreground">
                  Only unused letters are offered. {freePrefixes.length} left; after that, two-letter
                  prefixes.
                </p>
                <Button size="sm" onClick={handleAddCategory} disabled={addCategory.isPending}>
                  {addCategory.isPending ? "Reserving…" : "Reserve this letter"}
                </Button>
              </div>
            )}

            {/* ---- 3. the fields this kind actually has --------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Part Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                       placeholder={isPurchase ? "e.g. SCREW 4 X 9.5" : "e.g. Amplifier Board Assembly"} />
              </div>

              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Select value={uom} onValueChange={setUom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isPurchase && (
                <div className="space-y-2">
                  <Label>Sourcing</Label>
                  <Select value={sourcingType} onValueChange={(v) => setSourcingType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCAL">Local</SelectItem>
                      <SelectItem value="IMPORTED">Imported</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label>Specification</Label>
                <Textarea rows={2} value={specification}
                          onChange={(e) => setSpecification(e.target.value)} />
              </div>

              {isPurchase && (
                <>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input type="number" step="0.0001" value={unitPrice}
                           onChange={(e) => setUnitPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CBM per unit</Label>
                    <Input type="number" step="0.000001" value={cbm}
                           onChange={(e) => setCbm(e.target.value)} />
                  </div>

                  {sourcingType === "IMPORTED" && (
                    <>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="RMB">RMB</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Supplier Country</Label>
                        <Input value={supplierCountry}
                               onChange={(e) => setSupplierCountry(e.target.value)} />
                      </div>
                    </>
                  )}

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Vendors</Label>
                    <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedVendors.length
                            ? `${selectedVendors.length} vendor(s) selected`
                            : "Select vendors"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search vendors..." />
                          <CommandList>
                            <CommandEmpty>No vendors found.</CommandEmpty>
                            <CommandGroup>
                              {vendors.map((v: any) => {
                                const picked = selectedVendors.includes(v.id);
                                return (
                                  <CommandItem
                                    key={v.id}
                                    value={v.name}
                                    onSelect={() => {
                                      setSelectedVendors((prev) =>
                                        picked ? prev.filter((id) => id !== v.id) : [...prev, v.id],
                                      );
                                      if (!picked && !primaryVendor) setPrimaryVendor(v.id);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", picked ? "opacity-100" : "opacity-0")} />
                                    {v.name}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedVendors.length > 1 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedVendors.map((id) => {
                          const v = vendors.find((x: any) => x.id === id);
                          return (
                            <button key={id} type="button" onClick={() => setPrimaryVendor(id)}>
                              <Badge variant={primaryVendor === id ? "default" : "secondary"}>
                                {v?.name}{primaryVendor === id ? " • primary" : ""}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {!isPurchase && (
                <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {kind === "ASSEMBLED_INLINE"
                    ? "Built on the line and consumed there, so it holds no stock of its own. Its bill of materials explodes straight through to raw material when production is planned."
                    : kind === "ASSEMBLED_STOCKED"
                      ? "Built here and put into the store, so it holds its own stock and is issued to production like any other part."
                      : "Dispatched, serialised and invoiced."}{" "}
                  Add its bill of materials on the Bill of Materials tab once it is saved.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!kind || !partCode || saving || issuing}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Create Part"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
