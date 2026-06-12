import { Building2 } from "lucide-react";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { usePlant } from "@/contexts/PlantContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Dashboard-only scope toggle. Offers exactly two options:
 *   1. The plant currently active in the header Plant Switcher
 *   2. "All plants (company)" — consolidated rollup
 * To view a different single plant, switch it via the header first.
 */
export function DashboardScopeSwitcher() {
  const { scopePlantId, setScopePlantId } = useDashboardScope();
  const { activePlant } = usePlant();

  if (!activePlant) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={scopePlantId ?? "__all__"}
        onValueChange={(v) => setScopePlantId(v === "__all__" ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={activePlant.id}>{activePlant.name}</SelectItem>
          <SelectItem value="__all__">All plants (company)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}