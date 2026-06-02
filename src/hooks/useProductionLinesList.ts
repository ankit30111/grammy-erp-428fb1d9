import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlant } from "@/contexts/PlantContext";

export type LineTypeKey = "line" | "sub_assembly" | "cell";

export interface ProductionLineEntry {
  id: string;
  code: string;
  name: string;
  line_type: LineTypeKey;
  sort_order: number;
}

const TYPE_LABEL: Record<LineTypeKey, string> = {
  line: "Main Assembly",
  sub_assembly: "Sub Assembly",
  cell: "Cell",
};

/**
 * Active-plant-scoped list of production lines/sub-assemblies/cells.
 * Single source of truth — managed from /management/plants → Lines dialog.
 */
export function useProductionLinesList() {
  const { activePlant } = usePlant();
  const plantId = activePlant?.id;

  const query = useQuery({
    enabled: !!plantId,
    queryKey: ["production-lines-active", plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_lines")
        .select("id, code, name, line_type, sort_order")
        .eq("plant_id", plantId!)
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductionLineEntry[];
    },
  });

  const rows = query.data ?? [];
  return {
    ...query,
    rows,
    /** Just the names, in display order — drop-in replacement for legacy hardcoded arrays. */
    names: rows.map((r) => r.name),
    /** [{ id, name, type }] — for the overview grid. */
    withType: rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: TYPE_LABEL[r.line_type],
    })),
  };
}