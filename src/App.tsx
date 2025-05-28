
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Projection from "./pages/Projection";
import PPC from "./pages/PPC";
import Purchase from "./pages/Purchase";
import Inventory from "./pages/Inventory";
import Production from "./pages/Production";
import GRN from "./pages/GRN";
import Quality from "./pages/Quality";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import Management from "./pages/Management";
import ProductsManagement from "./pages/management/ProductsManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import UserManagement from "./pages/UserManagement";
import HRManagement from "./pages/management/HRManagement";
import Vendors from "./pages/Vendors";
import FinishedGoods from "./pages/FinishedGoods";
import Dispatch from "./pages/Dispatch";
import SpareOrders from "./pages/SpareOrders";
import Sales from "./pages/Sales";
import React from "react";

const queryClient = new QueryClient();

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/spare-orders" element={<SpareOrders />} />
            <Route path="/planning" element={<PPC />} />
            <Route path="/production" element={<Production />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/quality/iqc" element={<IQC />} />
            <Route path="/quality/pqc" element={<PQC />} />
            <Route path="/quality/oqc" element={<OQC />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/grn" element={<GRN />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/spare-dispatch" element={<Sales />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/finished-goods" element={<FinishedGoods />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/hr-management" element={<HRManagement />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/management" element={<Management />} />
            <Route path="/management/products" element={<ProductsManagement />} />
            <Route path="/management/raw-materials" element={<RawMaterialsManagement />} />
            <Route path="/management/customers" element={<CustomersManagement />} />
            <Route path="/settings" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;
