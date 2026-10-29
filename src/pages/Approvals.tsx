
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import PurchaseOrderApprovalsEnhanced from "@/components/Approvals/PurchaseOrderApprovalsEnhanced";
import CAPAApprovalsTab from "@/components/Approvals/CAPAApprovalsTab";
import CAPATrackingTab from "@/components/Approvals/CAPATrackingTab";
import MasterApprovalsTab from "@/components/Approvals/MasterApprovalsTab";
import { EngineeringApprovals, useEngineeringCounts } from "@/components/Approvals/EngineeringApprovals";
import { usePermissions } from "@/hooks/usePermissions";

const baseTabs = [
  { id: "masters", label: "Parts, BOMs & Vendors" },
  { id: "purchase-orders", label: "Purchase Order Approvals" },
  { id: "capa-approvals", label: "CAPA Approvals" },
  { id: "capa-tracking", label: "CAPA Tracking" },
];

const Approvals = () => {
  const counts = useEngineeringCounts();
  const { canApprove } = usePermissions();
  // Management sees every queue; R&D sees what is waiting for R&D.
  const tabs = canApprove
    ? [{ id: "management", label: "Management", count: counts.management }, { id: "rnd", label: "R&D", count: counts.rnd }, ...baseTabs]
    : [{ id: "rnd", label: "R&D", count: counts.rnd }];
  const [picked, setActiveTab] = useState<string | null>(null);
  const activeTab = picked && tabs.some((t) => t.id === picked) ? picked : tabs[0].id;

  return (
    <DashboardLayout>
      <PageHeader title="Approvals" />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      <div className="pt-4">
        {activeTab === "masters" && <MasterApprovalsTab />}
        {activeTab === "management" && <EngineeringApprovals queue="management" />}
        {activeTab === "rnd" && <EngineeringApprovals queue="rnd" />}
        {activeTab === "purchase-orders" && <PurchaseOrderApprovalsEnhanced />}
        {activeTab === "capa-approvals" && <CAPAApprovalsTab />}
        {activeTab === "capa-tracking" && <CAPATrackingTab />}
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
