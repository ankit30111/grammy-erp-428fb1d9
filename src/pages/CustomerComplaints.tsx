import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { ComplaintReceiptForm } from "@/components/complaints/ComplaintReceiptForm";
import { ComplaintReceiptsList, ComplaintsList } from "@/components/complaints/ComplaintsList";
import { useCanHandleComplaints } from "@/hooks/useComplaints";

/**
 * Customer complaints: received one at a time or as a batch, each unit then
 * analysed by OQC, its faulty parts by IQC, and closed with a resolution.
 */
const CustomerComplaints = () => {
  const [params, setParams] = useSearchParams();
  const canReceive = useCanHandleComplaints();
  const tab = params.get("tab") ?? (canReceive ? "receive" : "complaints");

  return (
    <DashboardLayout>
      <PageHeader title="Customer Complaints" />
      <TabBar
        tabs={[...(canReceive ? [{ id: "receive", label: "Receive" }] : []), { id: "complaints", label: "Complaints" }, { id: "receipts", label: "Receipts" }]}
        value={tab} onChange={(t) => setParams((x) => { x.set("tab", t); return x; })} syncToUrl={false}
      />
      <div className="space-y-6 pt-4">
        {tab === "receive" && canReceive && <ComplaintReceiptForm />}
        {tab === "complaints" && <ComplaintsList />}
        {tab === "receipts" && <ComplaintReceiptsList />}
      </div>
    </DashboardLayout>
  );
};

export default CustomerComplaints;
