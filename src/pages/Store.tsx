
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import StoreDashboard from "./store/StoreDashboard";

export default function Store() {
  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <StoreDashboard />
      </div>
    </DashboardLayout>
  );
}
