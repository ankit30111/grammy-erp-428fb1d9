import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BomRow {
  id: string;
  parent_part_id: string;
  child_part_id: string;
  quantity: number;
  uom: string;
  version: number;
  is_active: boolean;
  is_critical: boolean;
  notes: string | null;
}

export interface BomTreeNode {
  bom_id: string | null;
  part_id: string;
  part_code: string;
  name: string;
  category: string;
  uom: string;
  source_type: string;
  quantity: number;
  level: number;
  children: BomTreeNode[];
}

const PURCHASED_PARENT_MESSAGE =
  "A purchased part cannot have a bill of materials. Change its type to an assembly or finished good first.";

export const readableBomError = (error: any) => {
  const message: string = error?.message || "";
  if (message.includes("bom_parent_must_be_made") || message.includes("purchased")) {
    return PURCHASED_PARENT_MESSAGE;
  }
  if (message.includes("bom_no_self_reference") || message.includes("parent_part_id <> child_part_id")) {
    return "A part cannot be inside itself.";
  }
  if (message.includes("duplicate key")) {
    return "That part is already on this bill of materials.";
  }
  return message || "Could not save the bill of materials line.";
};

/** Every active BOM line with both parts resolved. */
export const useBomLines = () => {
  return useQuery({
    queryKey: ["bom-lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bom")
        .select(
          `id, parent_part_id, child_part_id, quantity, uom, version, is_active, is_critical, notes,
           parent:parts!bom_parent_part_id_fkey ( id, part_code, name, category, uom, source_type ),
           child:parts!bom_child_part_id_fkey ( id, part_code, name, category, uom, source_type )`,
        )
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
};

/** Recursive tree for one parent part. */
export const useBomTree = (parentPartId?: string) => {
  const { data: lines = [], isLoading } = useBomLines();

  const build = (partId: string, level: number, seen: Set<string>): BomTreeNode[] => {
    if (seen.has(partId)) return [];
    const nextSeen = new Set(seen).add(partId);
    return lines
      .filter((line: any) => line.parent_part_id === partId)
      .map((line: any) => ({
        bom_id: line.id,
        part_id: line.child_part_id,
        part_code: line.child?.part_code ?? "",
        name: line.child?.name ?? "",
        category: line.child?.category ?? "",
        uom: line.uom ?? line.child?.uom ?? "PCS",
        source_type: line.child?.source_type ?? "PURCHASED",
        quantity: Number(line.quantity) || 0,
        level,
        children: build(line.child_part_id, level + 1, nextSeen),
      }))
      .sort((a, b) => a.part_code.localeCompare(b.part_code));
  };

  return {
    isLoading,
    tree: parentPartId ? build(parentPartId, 0, new Set()) : [],
    /** part ids that already have a bill of materials */
    parentIds: Array.from(new Set(lines.map((l: any) => l.parent_part_id))),
  };
};

export const useBomMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bom-lines"] });
    queryClient.invalidateQueries({ queryKey: ["shortages"] });
  };

  const addLine = useMutation({
    mutationFn: async (line: {
      parent_part_id: string;
      child_part_id: string;
      quantity: number;
      uom: string;
      is_critical?: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase.from("bom").insert(line).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Bill of materials line added");
    },
    onError: (error: any) => toast.error(readableBomError(error)),
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; quantity?: number; uom?: string; is_critical?: boolean }) => {
      const { error } = await supabase.from("bom").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Bill of materials line updated");
    },
    onError: (error: any) => toast.error(readableBomError(error)),
  });

  const removeLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bom").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Bill of materials line removed");
    },
    onError: (error: any) => toast.error(readableBomError(error)),
  });

  /**
   * Save a whole bill of materials at once.
   *
   * The screen hands over what the bill should be; this works out the difference
   * against what it is. Adding one line at a time was correct but unusable - a
   * soundbar has sixty lines, and sixty round trips is sixty chances to be
   * interrupted halfway and leave a half-built bill that looks finished.
   *
   * Lines are keyed by child part, not by row id, so a part ticked, unticked and
   * ticked again is the same line rather than a new one.
   */
  const saveBom = useMutation({
    mutationFn: async (input: {
      parent_part_id: string;
      lines: { child_part_id: string; quantity: number; uom: string; is_critical?: boolean }[];
    }) => {
      const { data: existing, error: readError } = await supabase
        .from("bom")
        .select("id, child_part_id, quantity, is_critical")
        .eq("parent_part_id", input.parent_part_id)
        .eq("is_active", true);
      if (readError) throw readError;

      const before = new Map((existing ?? []).map((r: any) => [r.child_part_id, r]));
      const after = new Map(input.lines.map((l) => [l.child_part_id, l]));

      const toInsert = input.lines.filter((l) => !before.has(l.child_part_id));
      const toDelete = (existing ?? []).filter((r: any) => !after.has(r.child_part_id));
      const toUpdate = (existing ?? []).filter((r: any) => {
        const next = after.get(r.child_part_id);
        return (
          next &&
          (Number(r.quantity) !== Number(next.quantity) ||
            Boolean(r.is_critical) !== Boolean(next.is_critical))
        );
      });

      if (toInsert.length) {
        const { error } = await supabase.from("bom").insert(
          toInsert.map((l) => ({ ...l, parent_part_id: input.parent_part_id })),
        );
        if (error) throw error;
      }
      for (const row of toUpdate) {
        const next = after.get(row.child_part_id)!;
        const { error } = await supabase
          .from("bom")
          .update({ quantity: next.quantity, uom: next.uom, is_critical: next.is_critical ?? false })
          .eq("id", row.id);
        if (error) throw error;
      }
      if (toDelete.length) {
        const { error } = await supabase
          .from("bom")
          .delete()
          .in("id", toDelete.map((r: any) => r.id));
        if (error) throw error;
      }

      return { added: toInsert.length, changed: toUpdate.length, removed: toDelete.length };
    },
    onSuccess: (result) => {
      invalidate();
      const parts = [
        result.added ? `${result.added} added` : null,
        result.changed ? `${result.changed} changed` : null,
        result.removed ? `${result.removed} removed` : null,
      ].filter(Boolean);
      // Says what changed rather than "Saved". On a sixty-line bill, "Saved" is
      // not enough to tell whether the one edit you meant to make went in.
      toast.success(parts.length ? `Bill of materials saved — ${parts.join(", ")}` : "No changes to save");
    },
    onError: (error: any) => toast.error(readableBomError(error)),
  });

  return { addLine, updateLine, removeLine, saveBom };
};

/** Backwards-compatible shape for screens not yet rewired. */
export const useBOM = useBomLines;
export const useBOMByProduct = (partId: string) => {
  const { tree, isLoading } = useBomTree(partId);
  return { data: tree, isLoading };
};
