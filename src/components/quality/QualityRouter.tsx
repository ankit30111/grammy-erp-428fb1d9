
import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import VendorCAPAManagement from "@/pages/quality/VendorCAPAManagement";

const QualityRouter = () => {
  return (
    <Routes>
      <Route path="/vendor-capa" element={<VendorCAPAManagement />} />
    </Routes>
  );
};

export default QualityRouter;
