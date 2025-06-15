import { Home, Plus, Wrench, Calendar, Package, BarChart2, Layers, ClipboardCheck, DollarSign, Users, FileText, UserPlus, Building2, User, MessageSquare, CheckSquare } from "lucide-react";

interface NavigationSubItem {
  to: string;
  label: string;
  badge?: number;
}

interface NavigationItem {
  to: string;
  icon: React.ReactElement;
  label: string;
  badge?: number;
  subItems?: NavigationSubItem[];
}

export const navigationItems: NavigationItem[] = [
  { to: "/", icon: <Home size={20} />, label: "Dashboard" },
  { to: "/projection", icon: <Plus size={20} />, label: "Add Projection" },
  { to: "/spare-orders", icon: <Wrench size={20} />, label: "Spare Orders" },
  { to: "/dashboard/ppc", icon: <Calendar size={20} />, label: "PPC" },
  { to: "/store", icon: <Package size={20} />, label: "Store" },
  { to: "/production", icon: <BarChart2 size={20} />, label: "Production" },
  { to: "/finished-goods", icon: <Layers size={20} />, label: "Finished Goods" },
  { to: "/approvals", icon: <CheckSquare size={20} />, label: "Approvals" },
  { to: "/quality", icon: <ClipboardCheck size={20} />, label: "Quality Control" },
  {
    to: "/sales",
    icon: <DollarSign size={20} />,
    label: "Sales",
    subItems: [
      { to: "/sales/spare-dispatch", label: "Spare Dispatch" },
      { to: "/dispatch", label: "Regular Dispatch" }
    ]
  },
  { to: "/customer-complaints", icon: <MessageSquare size={20} />, label: "Customer Complaints" },
  { to: "/management/hr", icon: <Users size={20} />, label: "Human Resources" }
];

export const managementItems: NavigationItem[] = [
  { to: "/management/products", icon: <FileText size={20} />, label: "Products" },
  { to: "/management/raw-materials", icon: <Layers size={20} />, label: "Raw Materials" },
  { to: "/management/customers", icon: <UserPlus size={20} />, label: "Customers" },
  { to: "/vendors", icon: <Building2 size={20} />, label: "Vendors" },
  { to: "/user-management", icon: <User size={20} />, label: "User Management" }
];
