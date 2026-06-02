
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/Layout/PageHeader";
import StoreDashboard from "./store/StoreDashboard";

export default function Store() {
  return (
    <DashboardLayout>
      <PageHeader title="Store" description="Receipts, issues and material movements" />
      <div className="page-card p-5">
        <StoreDashboard />
      </div>
    </DashboardLayout>
  );
}
