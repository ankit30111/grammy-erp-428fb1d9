
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/Auth/AuthGuard";

// Import all pages
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Projection from "./pages/Projection";
import SpareOrders from "./pages/SpareOrders";
import PPC from "./pages/PPC";
import Store from "./pages/Store";
import Production from "./pages/Production";
import FinishedGoods from "./pages/FinishedGoods";
import Approvals from "./pages/Approvals";
import Quality from "./pages/Quality";
import VendorCAPAManagement from "./pages/quality/VendorCAPAManagement";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import Dispatch from "./pages/Dispatch";
import CustomerComplaints from "./pages/CustomerComplaints";
import HRDashboard from "./pages/dashboards/HRDashboard";
import ProductsManagement from "./pages/management/ProductsManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import Vendors from "./pages/Vendors";
import UserManagement from "./pages/UserManagement";
import SpareDispatch from "./pages/sales/SpareDispatch";
import RegularDispatch from "./pages/sales/RegularDispatch";
import PPCDashboard from "./pages/dashboards/PPCDashboard";
import StoreDashboard from "./pages/dashboards/StoreDashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/projection" element={<AuthGuard><Projection /></AuthGuard>} />
            <Route path="/spare-orders" element={<AuthGuard><SpareOrders /></AuthGuard>} />
            <Route path="/dashboard/ppc" element={<AuthGuard><PPCDashboard /></AuthGuard>} />
            <Route path="/store" element={<AuthGuard><StoreDashboard /></AuthGuard>} />
            <Route path="/production" element={<AuthGuard><Production /></AuthGuard>} />
            <Route path="/finished-goods" element={<AuthGuard><FinishedGoods /></AuthGuard>} />
            <Route path="/approvals" element={<AuthGuard><Approvals /></AuthGuard>} />
            <Route path="/quality" element={<AuthGuard><Quality /></AuthGuard>} />
            <Route path="/quality/vendor-capa" element={<AuthGuard><VendorCAPAManagement /></AuthGuard>} />
            <Route path="/quality/iqc" element={<AuthGuard><IQC /></AuthGuard>} />
            <Route path="/quality/pqc" element={<AuthGuard><PQC /></AuthGuard>} />
            <Route path="/quality/oqc" element={<AuthGuard><OQC /></AuthGuard>} />
            <Route path="/dispatch" element={<AuthGuard><Dispatch /></AuthGuard>} />
            <Route path="/customer-complaints" element={<AuthGuard><CustomerComplaints /></AuthGuard>} />
            <Route path="/management/hr" element={<AuthGuard><HRDashboard /></AuthGuard>} />
            <Route path="/management/products" element={<AuthGuard><ProductsManagement /></AuthGuard>} />
            <Route path="/management/raw-materials" element={<AuthGuard><RawMaterialsManagement /></AuthGuard>} />
            <Route path="/management/customers" element={<AuthGuard><CustomersManagement /></AuthGuard>} />
            <Route path="/vendors" element={<AuthGuard><Vendors /></AuthGuard>} />
            <Route path="/user-management" element={<AuthGuard><UserManagement /></AuthGuard>} />
            <Route path="/sales/spare-dispatch" element={<AuthGuard><SpareDispatch /></AuthGuard>} />
            <Route path="/sales/regular-dispatch" element={<AuthGuard><RegularDispatch /></AuthGuard>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
