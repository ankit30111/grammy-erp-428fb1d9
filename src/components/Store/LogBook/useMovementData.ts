import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * LogBook now reads the append-only stock ledger.
 *
 * The old `material_movements` table was dropped in the backend rebuild. The
 * ledger carries the same information in a better shape: every row is one
 * posting, nothing is ever updated or deleted, and `qty_delta` is signed, so
 * direction is a fact rather than something guessed from the movement type.
 *
 * `quantity` below is the absolute value, for display. `qtyDelta` keeps the
 * sign — use it for +/- styling instead of string-matching the type.
 */
export interface MaterialMovement {
  id: string;
  created_at: string;
  movement_type: string;
  part_id: string;
  /** absolute quantity, for display */
  quantity: number;
  /** signed: positive = into stock, negative = out of stock */
  qtyDelta: number;
  /** running balance at that location immediately after this posting */
  balance_after: number | null;
  reference_id: string | null;
  reference_type: string | null;
  reference_number: string | null;
  reason_code: string | null;
  notes: string | null;
  location_code: string | null;
  location_name: string | null;
  parts?: {
    part_code: string;
    name: string;
    category: string;
  };
}

interface LedgerRow {
  id: string;
  created_at: string;
  movement_type: string;
  part_id: string;
  qty_delta: number;
  balance_after: number | null;
  reference_id: string | null;
  reference_type: string | null;
  reference_number: string | null;
  reason_code: string | null;
  notes: string | null;
  parts: { part_code: string; name: string; category: string } | null;
  stock_locations: { code: string; name: string } | null;
}

export const useMovementData = (filterType: string) => {
  const { data: movements = [], isLoading, refetch } = useQuery({
    queryKey: ["stock-ledger-logbook", filterType],
    queryFn: async () => {
      let query = supabase
        .from("stock_ledger")
        .select(
          `
          id,
          created_at,
          movement_type,
          part_id,
          qty_delta,
          balance_after,
          reference_id,
          reference_type,
          reference_number,
          reason_code,
          notes,
          parts!inner(
            part_code,
            name,
            category
          ),
          stock_locations(
            code,
            name
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("movement_type", filterType);
      }

      const { data, error } = await query.limit(500);

      if (error) {
        console.error("Error fetching stock ledger for LogBook:", error);
        throw error;
      }

      return ((data ?? []) as unknown as LedgerRow[]).map(
        (row): MaterialMovement => ({
          id: row.id,
          created_at: row.created_at,
          movement_type: row.movement_type,
          part_id: row.part_id,
          quantity: Math.abs(Number(row.qty_delta)),
          qtyDelta: Number(row.qty_delta),
          balance_after:
            row.balance_after === null ? null : Number(row.balance_after),
          reference_id: row.reference_id,
          reference_type: row.reference_type,
          reference_number: row.reference_number,
          reason_code: row.reason_code,
          notes: row.notes,
          location_code: row.stock_locations?.code ?? null,
          location_name: row.stock_locations?.name ?? null,
          parts: row.parts ?? undefined,
        })
      );
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Auto-refresh when another tab dispatches or receives material.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "material_dispatched" ||
        e.key === "material_received" ||
        e.key === "material_request_created"
      ) {
        refetch();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refetch]);

  // Real-time: the ledger is insert-only, so INSERT is the only event that matters.
  useEffect(() => {
    const channel = supabase
      .channel("stock-ledger-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_ledger" },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return {
    movements,
    isLoading,
    refetch,
  };
};
