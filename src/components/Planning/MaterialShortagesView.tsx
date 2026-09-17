import { usePlantId } from "@/hooks/usePlantId";
import { useShortages } from "@/hooks/useShortages";
import MaterialShortages from "@/components/PPC/MaterialShortages";

export const MaterialShortagesView = () => {
  const plantId = usePlantId();
  const { data: shortages = [], isLoading } = useShortages(plantId);

  if (isLoading) {
    return <div className="text-center py-6 text-muted-foreground">Working out shortages...</div>;
  }

  return <MaterialShortages shortages={shortages} />;
};

export default MaterialShortagesView;
