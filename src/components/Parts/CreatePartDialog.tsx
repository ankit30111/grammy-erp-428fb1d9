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
import { useParts } from "@/hooks/useParts";
import {
  usePartCategories, issuePartCode, useBrands, PART_TIERS, type PartTier,
} from "@/hooks/usePartCategories";
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
 * All three made-here tiers behave the same way: they are built, they hold stock,
 * they are issued and returned, and they are inspected as they are made rather
 * than on arrival - so each carries a CIR sheet and a PQC checklist where a
 * purchased part carries a specification sheet and an IQC checklist.
 *
 * Semi-finished and sub-assembled are therefore identical to the ledger and
 * different on the floor. The names are still being settled inside Grammy; the
 * tier is where that decision lands, and nothing in stock or planning depends on
 * it.
 */
const TIER_ICON: Record<PartTier, typeof ShoppingCart> = {
  PURCHASE: ShoppingCart,
  SEMI_FINISHED: Wrench,
  SUB_ASSEMBLED: Layers,
  FINISHED: Package,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePartDialog = ({ open, onOpenChange }: Props) => {
  const { addPart } = useParts();
  const { categories, freePrefixes, addCategory } = usePartCategories();
  const { vendors = [] } = useVendors();
  const { brands, addBrand } = useBrands();
  const [brand, setBrand] = useState("");
  const [newBrandLetter, setNewBrandLetter] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  const [tier, setTier] = useState<PartTier | null>(null);
  const [categoryPrefix, setCategoryPrefix] = useState("");
  const [partCode, setPartCode] = useState("");
  const [issuing, setIssuing] = useState(false);

  const [name, setName] = useState("");
  const [uom, setUom] = useState("PCS");
  const [specification, setSpecification] = useState("");

  // Documents. Which two are asked for depends on where the part is inspected.
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [iqcFile, setIqcFile] = useState<File | null>(null);
  const [cirFile, setCirFile] = useState<File | null>(null);
  const [pqcFile, setPqcFile] = useState<File | null>(null);

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

  const tierMeta = PART_TIERS.find((t) => t.value === tier);
  const isPurchase = tier === "PURCHASE";
  const isFinished = tier === "FINISHED";

  const tierCategories = useMemo(
    () => categories.filter((c) => c.tier === tier),
    [categories, tier],
  );

  const reset = () => {
    setTier(null); setCategoryPrefix(""); setPartCode("");
    setName(""); setUom("PCS"); setSpecification("");
    setSpecFile(null); setIqcFile(null); setCirFile(null); setPqcFile(null);
    setSourcingType("LOCAL"); setCurrency(""); setUnitPrice(""); setCbm("");
    setSupplierCountry(""); setSelectedVendors([]); setPrimaryVendor("");
    setAddingCategory(false); setNewPrefix(""); setNewCategoryName("");
    setBrand(""); setNewBrandLetter(""); setNewBrandName("");
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
  }, [tier]);

  // A finished good's code ends in its brand letter, so it cannot be issued until
  // both the category and the brand are chosen.
  const chooseCategory = async (prefix: string, brandLetter = brand) => {
    setCategoryPrefix(prefix);
    setPartCode("");
    if (isFinished && !brandLetter) return;
    setIssuing(true);
    try {
      setPartCode(await issuePartCode(prefix, isFinished ? brandLetter : undefined));
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
    // Purchase parts keep one letter, as they always have. Anything built here
    // takes two, so the code alone says which side of the factory door it is from.
    const rule = isPurchase ? /^[A-Z]$/ : /^[A-Z]{2}$/;
    if (!rule.test(newPrefix.toUpperCase())) {
      toast.error(isPurchase ? "A purchase-part prefix is one letter" : "This prefix is two letters");
      return;
    }
    if (!newCategoryName.trim()) {
      toast.error("Give the category a name");
      return;
    }
    await addCategory.mutateAsync({
      prefix: newPrefix.toUpperCase(),
      name: newCategoryName,
      tier: tier!,
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
        specification: specification.trim() || undefined,
        // The database reads the source type off the category, so it is not sent
        // from here at all. One writer per column.
        ...(isPurchase
          ? {
              specificationFile: specFile || undefined,
              iqcChecklistFile: iqcFile || undefined,
              sourcing_type: sourcingType,
              currency: sourcingType === "IMPORTED" ? currency || undefined : undefined,
              unit_price: unitPrice ? parseFloat(unitPrice) : undefined,
              cbm_per_unit: cbm ? parseFloat(cbm) : undefined,
              supplier_country:
                sourcingType === "IMPORTED" ? supplierCountry || undefined : undefined,
              vendorIds: selectedVendors,
              primaryVendorId: primaryVendor,
            }
          : {
              cirSheetFile: cirFile || undefined,
              pqcChecklistFile: pqcFile || undefined,
            }),
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
            {PART_TIERS.map((k) => {
              const Icon = TIER_ICON[k.value];
              const active = tier === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setTier(k.value)}
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

        {tier && (
          <div className="space-y-4 border-t pt-4">
            {/* ---- 2. category and the code it issues ----------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={categoryPrefix} onValueChange={chooseCategory}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        tierCategories.length === 0
                          ? "No category yet for this kind"
                          : "Select category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tierCategories.map((c) => (
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
                  New category for {tierMeta?.label.toLowerCase()}
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
                    <span className="text-muted-foreground">{isFinished && !brand ? "Choose a category and brand" : "Choose a category"}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Issued by the system, so two people creating a part at once cannot get the same code.
                </p>
              </div>
            </div>

            {isFinished && (
              <div className="space-y-2">
                <Label>Brand *</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={brand}
                    onValueChange={(v) => { setBrand(v); if (categoryPrefix) chooseCategory(categoryPrefix, v); }}
                  >
                    <SelectTrigger className="w-60"><SelectValue placeholder="Built for which brand?" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.letter} value={b.letter}>{b.name} ({b.letter})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="w-16" maxLength={1} placeholder="P" value={newBrandLetter}
                         onChange={(e) => setNewBrandLetter(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
                  <Input className="w-40" placeholder="New brand name" value={newBrandName}
                         onChange={(e) => setNewBrandName(e.target.value)} />
                  <Button type="button" variant="outline" size="sm"
                          disabled={!newBrandLetter || !newBrandName.trim() || addBrand.isPending}
                          onClick={async () => {
                            await addBrand.mutateAsync({ letter: newBrandLetter, name: newBrandName });
                            const l = newBrandLetter;
                            setNewBrandLetter(""); setNewBrandName(""); setBrand(l);
                            if (categoryPrefix) chooseCategory(categoryPrefix, l);
                          }}>
                    Add brand
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The last letter of a finished-good code is its brand — JP-001P is built for P.
                </p>
              </div>
            )}

            {addingCategory && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Letter</Label>
                    {isPurchase ? (
                      <Select value={newPrefix} onValueChange={setNewPrefix}>
                        <SelectTrigger><SelectValue placeholder="Free letters" /></SelectTrigger>
                        <SelectContent>
                          {freePrefixes.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={newPrefix}
                        maxLength={2}
                        placeholder="e.g. JP"
                        onChange={(e) => setNewPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                      />
                    )}
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

                  <div className="space-y-2">
                    <Label>Specification Sheet (PDF)</Label>
                    <Input type="file" accept=".pdf"
                           onChange={(e) => setSpecFile(e.target.files?.[0] || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label>IQC Checklist (PDF)</Label>
                    <Input type="file" accept=".pdf"
                           onChange={(e) => setIqcFile(e.target.files?.[0] || null)} />
                  </div>

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
                <>
                  {/* A part Grammy builds is inspected as it is made, not on
                      arrival, so the two documents it carries are the CIR sheet
                      and the PQC checklist rather than a spec sheet and an IQC
                      checklist. Same pair for all three made-here tiers. */}
                  <div className="space-y-2">
                    <Label>CIR Sheet (PDF)</Label>
                    <Input type="file" accept=".pdf"
                           onChange={(e) => setCirFile(e.target.files?.[0] || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label>PQC Checklist (PDF)</Label>
                    <Input type="file" accept=".pdf"
                           onChange={(e) => setPqcFile(e.target.files?.[0] || null)} />
                  </div>
                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Built here and stocked: it can be made ahead of a plan, issued a few at a time,
                    and returned to the store. Add its bill of materials on the Bill of Materials tab
                    once it is saved.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!tier || !partCode || saving || issuing}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Create Part"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
