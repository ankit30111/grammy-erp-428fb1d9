
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import StoreDashboard from "./store/StoreDashboard";

export default function Inventory() {
  return (
    <DashboardLayout>
      <PageHeader title="Inventory" subtitle="Live stock across raw materials and finished goods" />
      <div>
        <StoreDashboard />
      </div>
    </DashboardLayout>
  );
}
