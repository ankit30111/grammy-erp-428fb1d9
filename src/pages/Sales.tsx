
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import SpareDispatch from "./sales/SpareDispatch";
import RegularDispatch from "./sales/RegularDispatch";

const tabs = [
  { id: "spare-dispatch", label: "Spare Dispatch" },
  { id: "regular-dispatch", label: "Regular Dispatch" },
];

const Sales = () => {
  const [activeTab, setActiveTab] = useState("spare-dispatch");

  return (
    <DashboardLayout>
      <PageHeader title="Sales" />
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      <div className="pt-4">
        {activeTab === "spare-dispatch" && <SpareDispatch />}
        {activeTab === "regular-dispatch" && <RegularDispatch />}
      </div>
    </DashboardLayout>
  );
};

export default Sales;
