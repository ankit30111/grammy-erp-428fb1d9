import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PartSourceType } from "@/hooks/useParts";

/**
 * What the floor calls a kind of part. Semi-finished and sub-assembled are two
 * different things on the floor and the same thing in the ledger - both are
 * built here, both hold stock - so the distinction lives here, where a naming
 * decision can change it without touching stock or planning.
 */
export type PartTier = "PURCHASE" | "SEMI_FINISHED" | "SUB_ASSEMBLED" | "FINISHED";

export const PART_TIERS: { value: PartTier; label: string; blurb: string }[] = [
  { value: "PURCHASE", label: "Purchase Part", blurb: "Bought from a vendor as it is" },
  { value: "SEMI_FINISHED", label: "Semi-finished Good", blurb: "Built here, stocked, issued and returned" },
  { value: "SUB_ASSEMBLED", label: "Sub-assembled Good", blurb: "Built here, stocked, used inside other parts" },
  { value: "FINISHED", label: "Finished Good", blurb: "What gets packed and dispatched" },
];

export const tierLabel = (tier?: string | null) =>
  PART_TIERS.find((t) => t.value === tier)?.label ?? tier ?? "";

export interface PartCategory {
  prefix: string;
  name: string;
  tier: PartTier;
  /** Derived from tier by the database; never set directly. */
  kind: PartSourceType;
  next_sequence: number;
  is_active: boolean;
}

/**
 * The part-code prefixes, read from the registry rather than a list in the code.
 *
 * The list used to be a const array in PartsManagement.tsx. An array in one
 * screen cannot keep a promise about every screen: it cannot stop an import, a
 * second form, or next month from giving a finished good the letter F while
 * F-001 is a gasket. The table can, and the database refuses a part whose letter
 * is not in it.
 */
export const usePartCategories = () => {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["part-categories"],
    queryFn: async (): Promise<PartCategory[]> => {
      const { data, error } = await supabase
        .from("part_categories")
        .select("prefix, name, tier, kind, next_sequence, is_active")
        .eq("is_active", true)
        .order("prefix");
      if (error) throw error;
      return (data ?? []) as PartCategory[];
    },
  });

  const { data: freePrefixes = [] } = useQuery({
    queryKey: ["free-part-prefixes"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("free_part_prefixes").select("prefix");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.prefix);
    },
  });

  const addCategory = useMutation({
    mutationFn: async (input: { prefix: string; name: string; tier: PartTier }) => {
      // tier only. `kind` is a generated column - sending it is an error, and
      // that is the point: the ledger type cannot be set to disagree with the
      // tier because there is no way to set it at all.
      const { error } = await supabase.from("part_categories").insert({
        prefix: input.prefix.toUpperCase(),
        name: input.name.trim(),
        tier: input.tier,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      queryClient.invalidateQueries({ queryKey: ["part-categories"] });
      queryClient.invalidateQueries({ queryKey: ["free-part-prefixes"] });
      toast.success(`${input.prefix.toUpperCase()} is now reserved for ${input.name}`);
    },
    onError: (error: any) => {
      // 23505 on the primary key means the letter is taken, which is the one
      // outcome this whole table exists to produce. Say which thing has it.
      toast.error(
        error?.code === "23505"
          ? "That letter, or that category name, is already in use. Pick another letter."
          : error?.message || "Could not add the category",
      );
    },
  });

  return { categories, freePrefixes, isLoading, addCategory };
};

/**
 * Ask the database for the next code under a prefix.
 *
 * Deliberately not computed in the browser from max()+1: two people pressing
 * Create in the same second would both read the same maximum and both be handed
 * P-472. The function takes a row lock, so the second one waits and gets P-473.
 */
export const issuePartCode = async (prefix: string, brand?: string): Promise<string> => {
  const { data, error } = await supabase.rpc("next_part_code", {
    p_prefix: prefix,
    p_brand: brand ?? null,
  } as any);
  if (error) throw error;
  return data as string;
};

/**
 * The two-letter brand code that closes every finished-good code: JP-001PH is built for
 * the brand registered as PH. Kept in the database so a code means one brand
 * everywhere, the same way a category prefix means one kind of part.
 */
export const useBrands = () => {
  const queryClient = useQueryClient();
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async (): Promise<{ letter: string; name: string }[]> => {
      const { data, error } = await (supabase as any)
        .from("brands").select("letter, name").eq("is_active", true).order("letter");
      if (error) throw error;
      return data ?? [];
    },
  });
  const addBrand = useMutation({
    mutationFn: async (input: { letter: string; name: string }) => {
      const { error } = await (supabase as any)
        .from("brands").insert({ letter: input.letter.toUpperCase(), name: input.name.trim() });
      if (error) throw error;
    },
    onSuccess: (_d, i) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`${i.letter.toUpperCase()} is now ${i.name}`);
    },
    onError: (e: any) =>
      toast.error(e?.code === "23505" ? "That letter or brand name is already in use" : e?.message),
  });
  return { brands, addBrand };
};
