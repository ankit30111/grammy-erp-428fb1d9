import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import StoreDashboard from "./store/StoreDashboard";

export default function Store() {
  return (
    <DashboardLayout>
      {/* The only screen in the app that never said what it was. */}
      <PageHeader title="Store" />
      <StoreDashboard />
    </DashboardLayout>
  );
}
