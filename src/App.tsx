import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/ppc" element={<PPC />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/planning-dashboard" element={<PlanningDashboard />} />
          <Route path="/projection" element={<Projection />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/grn" element={<GRN />} />
          <Route path="/production" element={<Production />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/quality/iqc" element={<IQC />} />
          <Route path="/quality/pqc" element={<PQC />} />
          <Route path="/quality/oqc" element={<OQC />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/sales/regular-dispatch" element={<RegularDispatch />} />
          <Route path="/sales/spare-dispatch" element={<SpareDispatch />} />
          <Route path="/finished-goods" element={<FinishedGoods />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/spare-orders" element={<SpareOrders />} />
          <Route path="/customer-complaints" element={<CustomerComplaints />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/management" element={<Management />} />
          <Route path="/management/products" element={<ProductsManagement />} />
          <Route path="/management/customers" element={<CustomersManagement />} />
          <Route path="/management/raw-materials" element={<RawMaterialsManagement />} />
          <Route path="/management/hr" element={<HRManagement />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/store/*" element={<StoreDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
