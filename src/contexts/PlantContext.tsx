import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Plant {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface PlantContextType {
  plants: Plant[];
  activePlant: Plant | null;
  setActivePlant: (plantId: string) => void;
  loading: boolean;
}

const PlantContext = createContext<PlantContextType | undefined>(undefined);
const STORAGE_KEY = "active_plant_id";

export function PlantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [activePlant, setActivePlantState] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("plants")
        .select("id, code, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (error || !data) {
        console.warn("PlantContext: failed to load plants", error);
        setPlants([]);
        setLoading(false);
        return;
      }
      setPlants(data);

      // Resolve active plant: localStorage → user.default_plant_id → first plant
      const storedId = localStorage.getItem(STORAGE_KEY);
      let chosen: Plant | undefined = data.find((p) => p.id === storedId);

      if (!chosen && user?.id) {
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("default_plant_id")
          .eq("id", user.id)
          .maybeSingle();
        if (ua?.default_plant_id) {
          chosen = data.find((p) => p.id === ua.default_plant_id);
        }
      }
      if (!chosen) chosen = data[0];
      if (chosen) {
        setActivePlantState(chosen);
        localStorage.setItem(STORAGE_KEY, chosen.id);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setActivePlant = useCallback(
    (plantId: string) => {
      const plant = plants.find((p) => p.id === plantId);
      if (!plant) return;
      setActivePlantState(plant);
      localStorage.setItem(STORAGE_KEY, plant.id);
      if (user?.id) {
        supabase
          .from("user_accounts")
          .update({ default_plant_id: plant.id })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) console.warn("Failed to persist default plant", error);
          });
      }
    },
    [plants, user?.id]
  );

  return (
    <PlantContext.Provider value={{ plants, activePlant, setActivePlant, loading }}>
      {children}
    </PlantContext.Provider>
  );
}

export function usePlant() {
  const ctx = useContext(PlantContext);
  if (!ctx) throw new Error("usePlant must be used within PlantProvider");
  return ctx;
}