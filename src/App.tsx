
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";

import Auth from "./pages/Auth";
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
import { AuthGuard } from "@/components/Auth/AuthGuard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login page - no authentication required */}
            <Route path="/" element={<Auth />} />

            {/* All other routes require authentication */}
            <Route path="/dashboard" element={
              <AuthGuard>
                <Index />
              </AuthGuard>
            } />
            
            <Route path="/dashboard/ppc" element={
              <AuthGuard>
                <PPCDashboard />
              </AuthGuard>
            } />
            
            <Route path="/quality" element={
              <AuthGuard>
                <Quality />
              </AuthGuard>
            } />
            
            <Route path="/quality/iqc" element={
              <AuthGuard>
                <IQC />
              </AuthGuard>
            } />
            
            <Route path="/quality/pqc" element={
              <AuthGuard>
                <PQC />
              </AuthGuard>
            } />
            
            <Route path="/quality/oqc" element={
              <AuthGuard>
                <OQC />
              </AuthGuard>
            } />
            
            <Route path="/quality/capa" element={
              <AuthGuard>
                <CAPA />
              </AuthGuard>
            } />
            
            <Route path="/production" element={
              <AuthGuard>
                <Production />
              </AuthGuard>
            } />
            
            <Route path="/planning" element={
              <AuthGuard>
                <PlanningEnhanced />
              </AuthGuard>
            } />
            
            <Route path="/store" element={
              <AuthGuard>
                <Store />
              </AuthGuard>
            } />
            
            <Route path="/grn" element={
              <AuthGuard>
                <GRN />
              </AuthGuard>
            } />
            
            <Route path="/approvals" element={
              <AuthGuard>
                <Approvals />
              </AuthGuard>
            } />
            
            <Route path="/purchase-discrepancies" element={
              <AuthGuard>
                <PurchaseDiscrepancies />
              </AuthGuard>
            } />
            
            <Route path="/sales" element={
              <AuthGuard>
                <Sales />
              </AuthGuard>
            } />
            
            <Route path="/purchase" element={
              <AuthGuard>
                <Purchase />
              </AuthGuard>
            } />
            
            <Route path="/projection" element={
              <AuthGuard>
                <Projection />
              </AuthGuard>
            } />
            
            <Route path="/finished-goods" element={
              <AuthGuard>
                <FinishedGoods />
              </AuthGuard>
            } />
            
            <Route path="/customer-complaints" element={
              <AuthGuard>
                <CustomerComplaints />
              </AuthGuard>
            } />
            
            <Route path="/spare-orders" element={
              <AuthGuard>
                <SpareOrders />
              </AuthGuard>
            } />
            
            <Route path="/management/hr" element={
              <AuthGuard>
                <HRManagement />
              </AuthGuard>
            } />
            
            <Route path="/management/customers" element={
              <AuthGuard>
                <CustomersManagement />
              </AuthGuard>
            } />
            
            <Route path="/vendors" element={
              <AuthGuard>
                <Vendors />
              </AuthGuard>
            } />
            
            <Route path="/management/products" element={
              <AuthGuard>
                <ProductsManagement />
              </AuthGuard>
            } />
            
            <Route path="/management/raw-materials" element={
              <AuthGuard>
                <RawMaterialsManagement />
              </AuthGuard>
            } />
            
            <Route path="/settings" element={
              <AuthGuard>
                <Settings />
              </AuthGuard>
            } />
            
            <Route path="/user-management" element={
              <AuthGuard>
                <UserManagement />
              </AuthGuard>
            } />
            
            {/* Dashboard Routes */}
            <Route path="/dashboards/store" element={
              <AuthGuard>
                <StoreDashboard />
              </AuthGuard>
            } />
            
            <Route path="/dashboards/production" element={
              <AuthGuard>
                <ProductionMainDashboard />
              </AuthGuard>
            } />
            
            <Route path="/dashboards/sales" element={
              <AuthGuard>
                <SalesDashboard />
              </AuthGuard>
            } />
            
            <Route path="/dashboards/hr" element={
              <AuthGuard>
                <HRDashboard />
              </AuthGuard>
            } />
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
