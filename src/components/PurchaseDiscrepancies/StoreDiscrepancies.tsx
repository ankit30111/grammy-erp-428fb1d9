import { FeatureUnavailable } from "@/components/ui/feature-unavailable";

/**
 * Store receiving discrepancies.
 *
 * Built entirely on `store_discrepancies`, dropped in the database rebuild with
 * no replacement table.
 */
const StoreDiscrepancies = () => (
  <FeatureUnavailable
    title="Store discrepancies"
    droppedTables={["store_discrepancies"]}
    detail="Quantity differences found by the store at GRN receiving were tracked here."
  />
);

export default StoreDiscrepancies;
