import { useState } from "react";

import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { EmployeeManagement } from "@/components/HR/EmployeeManagement";
import { SkillMatrix } from "@/components/HR/SkillMatrix";
import { TrainingManagement } from "@/components/HR/TrainingManagement";
import { PayrollManagement } from "@/components/HR/PayrollManagement";
import { PerformanceReviews } from "@/components/HR/PerformanceReviews";
import { HRDashboard } from "@/components/HR/HRDashboard";

const hrTabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "employees", label: "Employees" },
  { id: "skills", label: "Skills Matrix" },
  { id: "training", label: "Training" },
  { id: "payroll", label: "Payroll" },
  { id: "performance", label: "Performance" },
];

const HRManagement = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <DashboardLayout>
      <PageHeader title="Human Resources" />
      <TabBar tabs={hrTabs} value={activeTab} onChange={setActiveTab} />
      <div className="space-y-6 pt-4">
        {activeTab === "dashboard" && <HRDashboard />}
        {activeTab === "employees" && <EmployeeManagement />}
        {activeTab === "skills" && <SkillMatrix />}
        {activeTab === "training" && <TrainingManagement />}
        {activeTab === "payroll" && <PayrollManagement />}
        {activeTab === "performance" && <PerformanceReviews />}
      </div>
    </DashboardLayout>
  );
};

export default HRManagement;
