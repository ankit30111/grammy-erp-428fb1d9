import { FeatureUnavailable } from "@/components/ui/feature-unavailable";

/**
 * Production material discrepancy feedback.
 *
 * This tab was built entirely on `production_material_discrepancies`, which was
 * dropped in the database rebuild with no replacement table. Rather than render
 * an empty (and misleading) table, we say so explicitly.
 */
const ProductionFeedbackTab = () => (
  <FeatureUnavailable
    title="Production material feedback"
    droppedTables={["production_material_discrepancies"]}
    detail="Kit quantity disputes raised by production were recorded here; they now need a new home before this tab can come back."
  />
);

export default ProductionFeedbackTab;
