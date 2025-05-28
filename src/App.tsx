import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/Auth/AuthGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
            <Route path="/projection" element={<AuthGuard><Projection /></AuthGuard>} />
            <Route path="/spare-orders" element={<AuthGuard><SpareOrders /></AuthGuard>} />
            <Route path="/ppc" element={<AuthGuard><PPC /></AuthGuard>} />
            <Route path="/planning" element={<AuthGuard><PPC /></AuthGuard>} />
            <Route path="/production" element={<AuthGuard><Production /></AuthGuard>} />
            <Route path="/quality" element={<AuthGuard><Quality /></AuthGuard>} />
            <Route path="/quality/iqc" element={<AuthGuard><IQC /></AuthGuard>} />
            <Route path="/quality/pqc" element={<AuthGuard><PQC /></AuthGuard>} />
            <Route path="/quality/oqc" element={<AuthGuard><OQC /></AuthGuard>} />
            <Route path="/inventory" element={<AuthGuard><Inventory /></AuthGuard>} />
            <Route path="/purchase" element={<AuthGuard><Purchase /></AuthGuard>} />
            <Route path="/grn" element={<AuthGuard><GRN /></AuthGuard>} />
            <Route path="/sales" element={<AuthGuard><Sales /></AuthGuard>} />
            <Route path="/sales/spare-dispatch" element={<AuthGuard><Sales /></AuthGuard>} />
            <Route path="/dispatch" element={<AuthGuard><Dispatch /></AuthGuard>} />
            <Route path="/finished-goods" element={<AuthGuard><FinishedGoods /></AuthGuard>} />
            <Route path="/user-management" element={<AuthGuard><UserManagement /></AuthGuard>} />
            <Route path="/hr-management" element={<AuthGuard><HRManagement /></AuthGuard>} />
            <Route path="/vendors" element={<AuthGuard><Vendors /></AuthGuard>} />
            <Route path="/management" element={<AuthGuard><Management /></AuthGuard>} />
            <Route path="/management/products" element={<AuthGuard><ProductsManagement /></AuthGuard>} />
            <Route path="/management/raw-materials" element={<AuthGuard><RawMaterialsManagement /></AuthGuard>} />
            <Route path="/management/customers" element={<AuthGuard><CustomersManagement /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Index /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
