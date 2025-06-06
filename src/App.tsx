
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/Auth/AuthGuard";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import PPC from "@/pages/PPC";
import Planning from "@/pages/Planning";
import PlanningDashboard from "@/pages/PlanningDashboard";
import Projection from "@/pages/Projection";
import Purchase from "@/pages/Purchase";
import GRN from "@/pages/GRN";
import Production from "@/pages/Production";
import Inventory from "@/pages/Inventory";
import Quality from "@/pages/Quality";
import IQC from "@/pages/quality/IQC";
import PQC from "@/pages/quality/PQC";
import OQC from "@/pages/quality/OQC";
import Sales from "@/pages/Sales";
import RegularDispatch from "@/pages/sales/RegularDispatch";
import SpareDispatch from "@/pages/sales/SpareDispatch";
import FinishedGoods from "@/pages/FinishedGoods";
import Dispatch from "@/pages/Dispatch";
import SpareOrders from "@/pages/SpareOrders";
import Vendors from "@/pages/Vendors";
import Management from "@/pages/Management";
import ProductsManagement from "@/pages/management/ProductsManagement";
import CustomersManagement from "@/pages/management/CustomersManagement";
import RawMaterialsManagement from "@/pages/management/RawMaterialsManagement";
import HRManagement from "@/pages/management/HRManagement";
import Resources from "@/pages/Resources";
import UserManagement from "@/pages/UserManagement";
import StoreDashboard from "@/pages/store/StoreDashboard";
import NotFound from "@/pages/NotFound";
import CustomerComplaints from "@/pages/CustomerComplaints";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected routes - all users have universal access */}
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/ppc" element={<AuthGuard><PPC /></AuthGuard>} />
          <Route path="/planning" element={<AuthGuard><Planning /></AuthGuard>} />
          <Route path="/planning-dashboard" element={<AuthGuard><PlanningDashboard /></AuthGuard>} />
          <Route path="/projection" element={<AuthGuard><Projection /></AuthGuard>} />
          <Route path="/purchase" element={<AuthGuard><Purchase /></AuthGuard>} />
          <Route path="/grn" element={<AuthGuard><GRN /></AuthGuard>} />
          <Route path="/production" element={<AuthGuard><Production /></AuthGuard>} />
          <Route path="/inventory" element={<AuthGuard><Inventory /></AuthGuard>} />
          <Route path="/quality" element={<AuthGuard><Quality /></AuthGuard>} />
          <Route path="/quality/iqc" element={<AuthGuard><IQC /></AuthGuard>} />
          <Route path="/quality/pqc" element={<AuthGuard><PQC /></AuthGuard>} />
          <Route path="/quality/oqc" element={<AuthGuard><OQC /></AuthGuard>} />
          <Route path="/sales" element={<AuthGuard><Sales /></AuthGuard>} />
          <Route path="/sales/regular-dispatch" element={<AuthGuard><RegularDispatch /></AuthGuard>} />
          <Route path="/sales/spare-dispatch" element={<AuthGuard><SpareDispatch /></AuthGuard>} />
          <Route path="/finished-goods" element={<AuthGuard><FinishedGoods /></AuthGuard>} />
          <Route path="/dispatch" element={<AuthGuard><Dispatch /></AuthGuard>} />
          <Route path="/spare-orders" element={<AuthGuard><SpareOrders /></AuthGuard>} />
          <Route path="/customer-complaints" element={<AuthGuard><CustomerComplaints /></AuthGuard>} />
          <Route path="/vendors" element={<AuthGuard><Vendors /></AuthGuard>} />
          <Route path="/management" element={<AuthGuard><Management /></AuthGuard>} />
          <Route path="/management/products" element={<AuthGuard><ProductsManagement /></AuthGuard>} />
          <Route path="/management/customers" element={<AuthGuard><CustomersManagement /></AuthGuard>} />
          <Route path="/management/raw-materials" element={<AuthGuard><RawMaterialsManagement /></AuthGuard>} />
          <Route path="/management/hr" element={<AuthGuard><HRManagement /></AuthGuard>} />
          <Route path="/resources" element={<AuthGuard><Resources /></AuthGuard>} />
          <Route path="/user-management" element={<AuthGuard><UserManagement /></AuthGuard>} />
          <Route path="/store/*" element={<AuthGuard><StoreDashboard /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
