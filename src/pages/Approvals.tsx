
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import PurchaseOrderApprovalsEnhanced from "@/components/Approvals/PurchaseOrderApprovalsEnhanced";
import CAPAApprovalsTab from "@/components/Approvals/CAPAApprovalsTab";
import CAPATrackingTab from "@/components/Approvals/CAPATrackingTab";

const tabs = [
  { id: "purchase-orders", label: "Purchase Order Approvals" },
  { id: "capa-approvals", label: "CAPA Approvals" },
  { id: "capa-tracking", label: "CAPA Tracking" },
];

const Approvals = () => {
  const [activeTab, setActiveTab] = useState("purchase-orders");

  return (
    <DashboardLayout>
      <PageHeader title="Approvals" />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      <div className="pt-4">
        {activeTab === "purchase-orders" && <PurchaseOrderApprovalsEnhanced />}
        {activeTab === "capa-approvals" && <CAPAApprovalsTab />}
        {activeTab === "capa-tracking" && <CAPATrackingTab />}
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
