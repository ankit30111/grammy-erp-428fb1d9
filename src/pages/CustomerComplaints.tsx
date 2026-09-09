import { useState } from "react";

import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import BatchReceiptEntry from "@/components/quality/BatchReceiptEntry";
import IndividualComplaintsManagement from "@/components/quality/IndividualComplaintsManagement";

const complaintTabs = [
  { id: "receipt", label: "Receipt Entry" },
  { id: "management", label: "Individual Complaints" },
];

const CustomerComplaints = () => {
  const [activeTab, setActiveTab] = useState("receipt");

  return (
    <DashboardLayout>
      <PageHeader
        title="Customer Complaints"
      />
      <TabBar tabs={complaintTabs} value={activeTab} onChange={setActiveTab} />
      <div className="space-y-6 pt-4">
        {activeTab === "receipt" && <BatchReceiptEntry />}
        {activeTab === "management" && <IndividualComplaintsManagement />}
      </div>
    </DashboardLayout>
  );
};

export default CustomerComplaints;
