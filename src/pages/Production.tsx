
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import ProductionLinesOverview from "@/components/Production/ProductionLinesOverview";
import ScheduledProductions from "@/components/Production/ScheduledProductions";
import MaterialRequests from "@/components/Production/MaterialRequests";
import OQCRejections from "@/components/Production/OQCRejections";
import CompletedProduction from "@/components/Production/CompletedProduction";

const tabs = [
  { id: "production-lines", label: "Production Lines" },
  { id: "scheduled", label: "Scheduled Productions" },
  { id: "completed", label: "Completed Production" },
  { id: "material-requests", label: "Material Requests" },
  { id: "oqc-rejections", label: "OQC Rejections" },
];

export default function Production() {
  const [activeTab, setActiveTab] = useState("production-lines");

  return (
    <DashboardLayout>
      <PageHeader
        title="Production"
      />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      <div className="pt-4">
        {activeTab === "production-lines" && <ProductionLinesOverview />}
        {activeTab === "scheduled" && <ScheduledProductions />}
        {activeTab === "completed" && <CompletedProduction />}
        {activeTab === "material-requests" && <MaterialRequests />}
        {activeTab === "oqc-rejections" && <OQCRejections />}
      </div>
    </DashboardLayout>
  );
}
