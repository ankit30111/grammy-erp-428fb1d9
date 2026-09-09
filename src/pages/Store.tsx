
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import StoreDashboard from "./store/StoreDashboard";

export default function Store() {
  return (
    <DashboardLayout>
      <StoreDashboard />
    </DashboardLayout>
  );
}
