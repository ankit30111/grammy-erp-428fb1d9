import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrands } from "@/hooks/usePartCategories";
import { cn } from "@/lib/utils";

/**
 * A customer's brands, picked from the brands master: the same two-letter
 * table brand codes (JA-006-PH), part branding and brand BOM lines use. A brand
 * that is not in the list yet is added here, and is then available everywhere.
 */
export function CustomerBrandPicker({ value, onChange, canAdd }: {
  value: string[];
  onChange: (letters: string[]) => void;
  canAdd: boolean;
}) {
  const { brands, addBrand } = useBrands();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  const sorted = useMemo(() => [...brands].sort((a, b) => a.name.localeCompare(b.name)), [brands]);
  const taken = new Set(brands.map((b) => b.letter));
  const nameTaken = brands.some((b) => b.name.trim().toUpperCase() === name.trim().toUpperCase());

  // First two letters of the name, or the first letters of its first two words.
  const suggest = (n: string) => {
    const words = n.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean);
    const cands = [
      words.length > 1 ? words[0][0] + words[1][0] : "",
      (words[0] ?? "").slice(0, 2),
      ...(words[0] ?? "").slice(1).split("").map((ch) => (words[0] ?? "")[0] + ch),
    ].filter((c) => /^[A-Z]{2}$/.test(c));
    return cands.find((c) => !taken.has(c)) ?? cands[0] ?? "";
  };

  const codeOk = /^[A-Z]{2}$/.test(code);
  const codeErr = code && !codeOk ? "Two letters, A–Z" : codeOk && taken.has(code)
    ? `${code} is already ${brands.find((b) => b.letter === code)?.name}` : "";
  const canSave = name.trim() && codeOk && !taken.has(code) && !nameTaken && !addBrand.isPending;

  const toggle = (letter: string) =>
    onChange(value.includes(letter) ? value.filter((l) => l !== letter) : [...value, letter]);

  const save = async () => {
    try {
      await addBrand.mutateAsync({ letter: code, name: name.trim() });
      onChange([...value, code]);
      setAdding(false); setName(""); setCode(""); setCodeTouched(false);
    } catch { /* useBrands shows the error */ }
  };

  return (
    <div className="space-y-2">
      <Label>Brands</Label>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((b) => {
          const on = value.includes(b.letter);
          return (
            <button key={b.letter} type="button" aria-pressed={on} onClick={() => toggle(b.letter)}
                    className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors",
                      on ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted")}>
              {on && <Check className="h-3.5 w-3.5" />}
              {b.name}<span className="font-mono text-xs opacity-70">{b.letter}</span>
            </button>
          );
        })}
        {canAdd && !adding && (
          <Button type="button" variant="outline" size="sm" className="h-[30px]" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> New brand
          </Button>
        )}
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">No brand picked. Leave it empty for a customer who buys under Grammy's own name.</p>}
      {adding && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Adds the brand to the brands list. Its two-letter code is used in brand codes (e.g. JA-006-{codeOk ? code : "PH"}) and cannot be changed later.
          </p>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <div className="space-y-1">
              <Label htmlFor="nb-name" className="text-xs">Brand name</Label>
              <Input id="nb-name" value={name} placeholder="e.g. SONY" autoFocus
                     onChange={(e) => { setName(e.target.value); if (!codeTouched) setCode(suggest(e.target.value)); }} />
              {nameTaken && <p className="text-xs text-destructive">That brand is already in the list</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="nb-code" className="text-xs">Code</Label>
              <Input id="nb-code" value={code} maxLength={2} className="font-mono uppercase"
                     onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} />
              {codeErr && <p className="text-xs text-destructive">{codeErr}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setName(""); setCode(""); setCodeTouched(false); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={!canSave} onClick={save}>
              {addBrand.isPending ? "Adding…" : `Add ${codeOk ? code : "brand"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
