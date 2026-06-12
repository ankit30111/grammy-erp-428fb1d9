import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePlant } from "@/contexts/PlantContext";

/**
 * Dashboard scope follows the header's active plant.
 * - `scopePlantId === null` ⇒ "All plants" (company-wide rollup).
 * - Otherwise ⇒ KPIs are filtered to that plant (always the header plant).
 *
 * Switching the header plant snaps the dashboard back to that plant
 * (single-plant view). The "All plants" choice is not preserved across
 * header plant switches.
 */
interface DashboardScopeContextValue {
  scopePlantId: string | null;
  setScopePlantId: (id: string | null) => void;
}

const DashboardScopeContext = createContext<DashboardScopeContextValue | undefined>(undefined);

export function DashboardScopeProvider({ children }: { children: React.ReactNode }) {
  const { activePlant } = usePlant();
  const [scopePlantId, setScopePlantIdState] = useState<string | null>(
    activePlant?.id ?? null
  );

  // Header plant changes always reset dashboard scope to that plant.
  useEffect(() => {
    if (activePlant) setScopePlantIdState(activePlant.id);
  }, [activePlant?.id]);

  const setScopePlantId = (id: string | null) => {
    setScopePlantIdState(id);
  };

  const value = useMemo(() => ({ scopePlantId, setScopePlantId }), [scopePlantId]);

  return (
    <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>
  );
}

export function useDashboardScope() {
  const ctx = useContext(DashboardScopeContext);
  if (!ctx) throw new Error("useDashboardScope must be used within DashboardScopeProvider");
  return ctx;
}