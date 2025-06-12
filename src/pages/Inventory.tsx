
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import StoreDashboard from "./store/StoreDashboard";

export default function Inventory() {
  return (
    <DashboardLayout>
      <StoreDashboard />
    </DashboardLayout>
  );
}
