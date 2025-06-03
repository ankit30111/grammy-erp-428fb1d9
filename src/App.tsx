
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/Auth/AuthGuard";
import Index from "./pages/Index";
import Projections from "./pages/Projection";
import Planning from "./pages/Planning";
import PlanningDashboard from "./pages/PlanningDashboard";
import PPC from "./pages/PPC";
import Store from "./pages/store/StoreDashboard";
import Production from "./pages/Production";
import Quality from "./pages/Quality";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import CustomerComplaints from "./pages/CustomerComplaints";
import Dispatch from "./pages/Dispatch";
import RegularDispatch from "./pages/sales/RegularDispatch";
import SpareDispatch from "./pages/sales/SpareDispatch";
import Purchase from "./pages/Purchase";
import Vendors from "./pages/Vendors";
import Inventory from "./pages/Inventory";
import FinishedGoods from "./pages/FinishedGoods";
import SpareOrders from "./pages/SpareOrders";
import Management from "./pages/Management";
import ProductsManagement from "./pages/management/ProductsManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import CustomersManagement from "./pages/management/CustomersManagement";
import HRManagement from "./pages/management/HRManagement";
import UserManagement from "./pages/UserManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/projections" element={<AuthGuard><Projections /></AuthGuard>} />
          <Route path="/planning" element={<AuthGuard><Planning /></AuthGuard>} />
          <Route path="/planning-dashboard" element={<AuthGuard><PlanningDashboard /></AuthGuard>} />
          <Route path="/ppc" element={<AuthGuard><PPC /></AuthGuard>} />
          <Route path="/store" element={<AuthGuard><Store /></AuthGuard>} />
          <Route path="/production" element={<AuthGuard><Production /></AuthGuard>} />
          <Route path="/quality" element={<AuthGuard><Quality /></AuthGuard>} />
          <Route path="/quality/iqc" element={<AuthGuard><IQC /></AuthGuard>} />
          <Route path="/quality/pqc" element={<AuthGuard><PQC /></AuthGuard>} />
          <Route path="/quality/oqc" element={<AuthGuard><OQC /></AuthGuard>} />
          <Route path="/customer-complaints" element={<AuthGuard><CustomerComplaints /></AuthGuard>} />
          <Route path="/dispatch" element={<AuthGuard><Dispatch /></AuthGuard>} />
          <Route path="/dispatch/regular" element={<AuthGuard><RegularDispatch /></AuthGuard>} />
          <Route path="/dispatch/spare" element={<AuthGuard><SpareDispatch /></AuthGuard>} />
          <Route path="/purchase" element={<AuthGuard><Purchase /></AuthGuard>} />
          <Route path="/vendors" element={<AuthGuard><Vendors /></AuthGuard>} />
          <Route path="/inventory" element={<AuthGuard><Inventory /></AuthGuard>} />
          <Route path="/finished-goods" element={<AuthGuard><FinishedGoods /></AuthGuard>} />
          <Route path="/spare-orders" element={<AuthGuard><SpareOrders /></AuthGuard>} />
          <Route path="/management" element={<AuthGuard><Management /></AuthGuard>} />
          <Route path="/management/products" element={<AuthGuard><ProductsManagement /></AuthGuard>} />
          <Route path="/management/raw-materials" element={<AuthGuard><RawMaterialsManagement /></AuthGuard>} />
          <Route path="/management/customers" element={<AuthGuard><CustomersManagement /></AuthGuard>} />
          <Route path="/management/hr" element={<AuthGuard><HRManagement /></AuthGuard>} />
          <Route path="/user-management" element={<AuthGuard><UserManagement /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
