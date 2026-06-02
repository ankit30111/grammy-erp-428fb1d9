import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePlant } from "@/contexts/PlantContext";

/**
 * Dashboard scope is independent from the active operational plant.
 * - `scopePlantId === null` ⇒ "All plants" (company-wide rollup).
 * - Otherwise ⇒ KPIs are filtered to that plant.
 *
 * Operational pages (PPC, Inventory, GRN, etc.) keep using `activePlant`;
 * only dashboard widgets read this scope.
 */
interface DashboardScopeContextValue {
  scopePlantId: string | null;
  setScopePlantId: (id: string | null) => void;
}

const STORAGE_KEY = "dashboard_scope_plant_id";
const ALL = "__all__";

const DashboardScopeContext = createContext<DashboardScopeContextValue | undefined>(undefined);

export function DashboardScopeProvider({ children }: { children: React.ReactNode }) {
  const { activePlant, plants } = usePlant();
  const [scopePlantId, setScopePlantIdState] = useState<string | null>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === ALL) return null;
    return stored ?? null;
  });

  // If user has no access to the persisted plant, fall back to "all".
  useEffect(() => {
    if (scopePlantId && plants.length > 0 && !plants.some((p) => p.id === scopePlantId)) {
      setScopePlantIdState(null);
      localStorage.setItem(STORAGE_KEY, ALL);
    }
  }, [plants, scopePlantId]);

  // Default once on first load: prefer the active plant rather than "all".
  useEffect(() => {
    if (scopePlantId === null && !localStorage.getItem(STORAGE_KEY) && activePlant) {
      setScopePlantIdState(activePlant.id);
      localStorage.setItem(STORAGE_KEY, activePlant.id);
    }
  }, [activePlant, scopePlantId]);

  const setScopePlantId = (id: string | null) => {
    setScopePlantIdState(id);
    localStorage.setItem(STORAGE_KEY, id ?? ALL);
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