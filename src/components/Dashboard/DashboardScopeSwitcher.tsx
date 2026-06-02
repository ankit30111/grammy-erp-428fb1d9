import { Building2 } from "lucide-react";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { usePlant } from "@/contexts/PlantContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Dashboard-only scope toggle. Lets the user see consolidated company KPIs
 * or drill into a single plant without changing the active operational plant.
 */
export function DashboardScopeSwitcher() {
  const { scopePlantId, setScopePlantId } = useDashboardScope();
  const { plants } = usePlant();

  if (plants.length <= 1) return null;

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
          <SelectItem value="__all__">All plants (company)</SelectItem>
          {plants.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}