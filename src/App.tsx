
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthGuard } from "@/components/Auth/AuthGuard";

const Index = lazy(() => import("@/pages/Index"));
const Auth = lazy(() => import("@/pages/Auth"));
const PPC = lazy(() => import("@/pages/PPC"));
const Planning = lazy(() => import("@/pages/Planning"));
const PlanningDashboard = lazy(() => import("@/pages/PlanningDashboard"));
const Projection = lazy(() => import("@/pages/Projection"));
const Purchase = lazy(() => import("@/pages/Purchase"));
const GRN = lazy(() => import("@/pages/GRN"));
const Production = lazy(() => import("@/pages/Production"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Quality = lazy(() => import("@/pages/Quality"));
const IQC = lazy(() => import("@/pages/quality/IQC"));
const PQC = lazy(() => import("@/pages/quality/PQC"));
const OQC = lazy(() => import("@/pages/quality/OQC"));
const Sales = lazy(() => import("@/pages/Sales"));
const RegularDispatch = lazy(() => import("@/pages/sales/RegularDispatch"));
const SpareDispatch = lazy(() => import("@/pages/sales/SpareDispatch"));
const FinishedGoods = lazy(() => import("@/pages/FinishedGoods"));
const Dispatch = lazy(() => import("@/pages/Dispatch"));
const SpareOrders = lazy(() => import("@/pages/SpareOrders"));
const Vendors = lazy(() => import("@/pages/Vendors"));
const Management = lazy(() => import("@/pages/Management"));
const ProductsManagement = lazy(() => import("@/pages/management/ProductsManagement"));
const CustomersManagement = lazy(() => import("@/pages/management/CustomersManagement"));
const RawMaterialsManagement = lazy(() => import("@/pages/management/RawMaterialsManagement"));
const HRManagement = lazy(() => import("@/pages/management/HRManagement"));
const Resources = lazy(() => import("@/pages/Resources"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const StoreDashboard = lazy(() => import("@/pages/store/StoreDashboard"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const CustomerComplaints = lazy(() => import("@/pages/CustomerComplaints"));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="p-4">Loading...</div>}>
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
      </Suspense>
    </Router>
  );
}

export default App;
