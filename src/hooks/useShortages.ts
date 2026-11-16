import { useQuery } from "@tanstack/react-query";
import { calculateShortages, ShortageLine } from "@/utils/materialShortageCalculator";

export interface ShortageRow extends ShortageLine {
  /** OPEN: still has to be ordered. ON_ORDER: purchase orders cover it. COVERED: stock covers it. */
  status: "OPEN" | "ON_ORDER" | "COVERED";
}

/**
 * The shortage list, worked out in the database each time it is read. It is
 * re-read every 30 seconds and whenever the window is opened again, so two
 * people at two locations never look at different numbers for long.
 */
export const useShortages = (plantId?: string | null) => {
  return useQuery({
    queryKey: ["shortages", plantId ?? "all"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ShortageRow[]> => {
      const lines = await calculateShortages(plantId);
      return lines.map((line) => ({
        ...line,
        status: line.to_order > 0 ? "OPEN" : line.shortage > 0 ? "ON_ORDER" : "COVERED",
      }));
    },
  });
};
