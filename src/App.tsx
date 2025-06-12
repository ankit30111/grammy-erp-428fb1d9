
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./main";
import Index from "./pages/Index";
import Production from "./pages/Production";
import Store from "./pages/Store";
import PPC from "./pages/PPC";
import Quality from "./pages/Quality";
import Purchase from "./pages/Purchase";
import Inventory from "./pages/Inventory";
import Planning from "./pages/Planning";
import PlanningDashboard from "./pages/PlanningDashboard";
import PlanningEnhanced from "./pages/PlanningEnhanced";
import Projection from "./pages/Projection";
import Vendors from "./pages/Vendors";
import Settings from "./pages/Settings";
import Resources from "./pages/Resources";
import Management from "./pages/Management";
import Sales from "./pages/Sales";
import SpareOrders from "./pages/SpareOrders";
import Dispatch from "./pages/Dispatch";
import FinishedGoods from "./pages/FinishedGoods";
import GRN from "./pages/GRN";
import Approvals from "./pages/Approvals";
import PurchaseDiscrepancies from "./pages/PurchaseDiscrepancies";
import UserManagement from "./pages/UserManagement";
import CustomerComplaints from "./pages/CustomerComplaints";
import NotFound from "./pages/NotFound";

// Dashboard imports
import StoreDashboard from "./pages/dashboards/StoreDashboard";
import PPCDashboard from "./pages/dashboards/PPCDashboard";
import ProductionMainDashboard from "./pages/dashboards/ProductionMainDashboard";
import SalesDashboard from "./pages/dashboards/SalesDashboard";
import HRDashboard from "./pages/dashboards/HRDashboard";

// Management imports
import ProductsManagement from "./pages/management/ProductsManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import HRManagement from "./pages/management/HRManagement";

// Quality imports
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";

// Sales imports
import RegularDispatch from "./pages/sales/RegularDispatch";
import SpareDispatch from "./pages/sales/SpareDispatch";

// Store imports
import StoreDashboardPage from "./pages/store/StoreDashboard";

import "./App.css";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/production" element={<Production />} />
            <Route path="/store" element={<Store />} />
            <Route path="/ppc" element={<PPC />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/planning-dashboard" element={<PlanningDashboard />} />
            <Route path="/planning-enhanced" element={<PlanningEnhanced />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/management" element={<Management />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/spare-orders" element={<SpareOrders />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/finished-goods" element={<FinishedGoods />} />
            <Route path="/grn" element={<GRN />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/purchase-discrepancies" element={<PurchaseDiscrepancies />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/customer-complaints" element={<CustomerComplaints />} />

            {/* Dashboard Routes */}
            <Route path="/dashboards/store" element={<StoreDashboard />} />
            <Route path="/dashboards/ppc" element={<PPCDashboard />} />
            <Route path="/dashboards/production" element={<ProductionMainDashboard />} />
            <Route path="/dashboards/sales" element={<SalesDashboard />} />
            <Route path="/dashboards/hr" element={<HRDashboard />} />

            {/* Management Routes */}
            <Route path="/management/products" element={<ProductsManagement />} />
            <Route path="/management/customers" element={<CustomersManagement />} />
            <Route path="/management/raw-materials" element={<RawMaterialsManagement />} />
            <Route path="/management/hr" element={<HRManagement />} />

            {/* Quality Routes */}
            <Route path="/quality/iqc" element={<IQC />} />
            <Route path="/quality/pqc" element={<PQC />} />
            <Route path="/quality/oqc" element={<OQC />} />

            {/* Sales Routes */}
            <Route path="/sales/regular-dispatch" element={<RegularDispatch />} />
            <Route path="/sales/spare-dispatch" element={<SpareDispatch />} />

            {/* Store Routes */}
            <Route path="/store/dashboard" element={<StoreDashboardPage />} />

            {/* Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
