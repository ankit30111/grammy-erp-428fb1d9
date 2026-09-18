import { FeatureUnavailable } from "@/components/ui/feature-unavailable";

/**
 * Bulk customer-complaint receipt entry.
 *
 * Built on `customer_complaint_batches` / `customer_complaint_batch_items`,
 * both dropped in the database rebuild with no replacement. Individual
 * complaints are still captured on `customer_complaints`.
 */
const BatchReceiptEntry = () => (
  <FeatureUnavailable
    title="Batch complaint receipt"
    droppedTables={["customer_complaint_batches", "customer_complaint_batch_items"]}
    detail="Complaints can still be raised one at a time against customer_complaints."
  />
);

export default BatchReceiptEntry;
