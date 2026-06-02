import { usePlant } from "@/contexts/PlantContext";

/**
 * Thin convenience hook returning the active plant id (or undefined while loading).
 * Use in data hooks to filter selects and stamp inserts with `plant_id`.
 */
export function usePlantId(): string | undefined {
  const { activePlant } = usePlant();
  return activePlant?.id;
}