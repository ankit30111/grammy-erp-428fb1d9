import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sonner } from 'sonner';

import Authentication from "./Authentication";
import Dashboard from "./Dashboard";
import Quality from "./Quality";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import Production from "./Production";
import Planning from "./Planning";
import Store from "./Store";
import Sales from "./Sales";
import Purchase from "./Purchase";
import Projection from "./Projection";
import FinishedGoods from "./FinishedGoods";
import CustomerComplaints from "./CustomerComplaints";
import SpareOrders from "./SpareOrders";
import HRManagement from "./pages/management/HRManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import VendorManagement from "./pages/management/VendorManagement";
import ProductsManagement from "./pages/management/ProductsManagement";
import Settings from "./Settings";
import PageNotFound from "./PageNotFound";
import PPCDashboard from "@/pages/dashboards/PPCDashboard";
import StoreDashboard from "@/pages/dashboards/StoreDashboard";
import ProductionMainDashboard from "@/pages/dashboards/ProductionMainDashboard";
import SalesDashboard from "@/pages/dashboards/SalesDashboard";
import HRDashboard from "@/pages/dashboards/HRDashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/" element={<Authentication />} />

            {/* Main Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/quality/iqc" element={<IQC />} />
            <Route path="/quality/pqc" element={<PQC />} />
            <Route path="/quality/oqc" element={<OQC />} />
            <Route path="/production" element={<Production />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/store" element={<Store />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/finished-goods" element={<FinishedGoods />} />
            <Route path="/customer-complaints" element={<CustomerComplaints />} />
            <Route path="/spare-orders" element={<SpareOrders />} />
            <Route path="/management/hr" element={<HRManagement />} />
            <Route path="/management/customers" element={<CustomersManagement />} />
            <Route path="/management/vendors" element={<VendorManagement />} />
            <Route path="/management/products" element={<ProductsManagement />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* Dashboard Routes */}
            <Route path="/dashboards/ppc" element={<PPCDashboard />} />
            <Route path="/dashboards/store" element={<StoreDashboard />} />
            <Route path="/dashboards/production" element={<ProductionMainDashboard />} />
            <Route path="/dashboards/sales" element={<SalesDashboard />} />
            <Route path="/dashboards/hr" element={<HRDashboard />} />
            
            {/* 404 Route */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
