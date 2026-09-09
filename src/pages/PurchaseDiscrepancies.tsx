import { useState } from "react";

import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import IQCDiscrepancies from "@/components/PurchaseDiscrepancies/IQCDiscrepancies";
import StoreDiscrepancies from "@/components/PurchaseDiscrepancies/StoreDiscrepancies";

const discrepancyTabs = [
  { id: "iqc-discrepancy", label: "IQC Discrepancy" },
  { id: "store-discrepancy", label: "Store Discrepancy" },
];

const PurchaseDiscrepancies = () => {
  const [activeTab, setActiveTab] = useState("iqc-discrepancy");

  return (
    <DashboardLayout>
      <PageHeader
        title="Purchase Discrepancies"
        subtitle="Monitor and resolve material receiving discrepancies"
      />
      <TabBar tabs={discrepancyTabs} value={activeTab} onChange={setActiveTab} />
      <div className="grid gap-4 pt-4 md:gap-6">
        {activeTab === "iqc-discrepancy" && <IQCDiscrepancies />}
        {activeTab === "store-discrepancy" && <StoreDiscrepancies />}
      </div>
    </DashboardLayout>
  );
};

export default PurchaseDiscrepancies;
