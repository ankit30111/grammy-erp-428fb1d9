
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";

import Index from "./pages/Index";
import Quality from "./pages/Quality";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import CAPA from "./pages/quality/CAPA";
import Production from "./pages/Production";
import Planning from "./pages/Planning";
import PlanningEnhanced from "./pages/PlanningEnhanced";
import Store from "./pages/Store";
import Sales from "./pages/Sales";
import Purchase from "./pages/Purchase";
import Projection from "./pages/Projection";
import FinishedGoods from "./pages/FinishedGoods";
import CustomerComplaints from "./pages/CustomerComplaints";
import SpareOrders from "./pages/SpareOrders";
import HRManagement from "./pages/management/HRManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import Vendors from "./pages/Vendors";
import ProductsManagement from "./pages/management/ProductsManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PPCDashboard from "@/pages/dashboards/PPCDashboard";
import StoreDashboard from "@/pages/dashboards/StoreDashboard";
import ProductionMainDashboard from "@/pages/dashboards/ProductionMainDashboard";
import SalesDashboard from "@/pages/dashboards/SalesDashboard";
import HRDashboard from "@/pages/dashboards/HRDashboard";
import GRN from "./pages/GRN";
import Approvals from "./pages/Approvals";
import PurchaseDiscrepancies from "./pages/PurchaseDiscrepancies";
import UserManagement from "./pages/UserManagement";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Default route now goes directly to dashboard */}
            <Route path="/" element={<Index />} />

            {/* All routes are now accessible without authentication */}
            <Route path="/dashboard" element={<Index />} />
            <Route path="/dashboard/ppc" element={<PPCDashboard />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/quality/iqc" element={<IQC />} />
            <Route path="/quality/pqc" element={<PQC />} />
            <Route path="/quality/oqc" element={<OQC />} />
            <Route path="/quality/capa" element={<CAPA />} />
            <Route path="/production" element={<Production />} />
            <Route path="/planning" element={<PlanningEnhanced />} />
            <Route path="/store" element={<Store />} />
            <Route path="/grn" element={<GRN />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/purchase-discrepancies" element={<PurchaseDiscrepancies />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/finished-goods" element={<FinishedGoods />} />
            <Route path="/customer-complaints" element={<CustomerComplaints />} />
            <Route path="/spare-orders" element={<SpareOrders />} />
            <Route path="/management/hr" element={<HRManagement />} />
            <Route path="/management/customers" element={<CustomersManagement />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/management/products" element={<ProductsManagement />} />
            <Route path="/management/raw-materials" element={<RawMaterialsManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/user-management" element={<UserManagement />} />
            
            {/* Dashboard Routes */}
            <Route path="/dashboards/store" element={<StoreDashboard />} />
            <Route path="/dashboards/production" element={<ProductionMainDashboard />} />
            <Route path="/dashboards/sales" element={<SalesDashboard />} />
            <Route path="/dashboards/hr" element={<HRDashboard />} />
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
