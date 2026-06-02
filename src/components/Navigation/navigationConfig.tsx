
import { Home, Plus, Wrench, Calendar, Package, BarChart2, Layers, ClipboardCheck, DollarSign, Users, FileText, UserPlus, Building2, User, MessageSquare, CheckSquare, Lightbulb, Container, Speaker } from "lucide-react";

interface NavigationSubItem {
  to: string;
  label: string;
  badge?: number;
}

export interface NavigationItem {
  to: string;
  icon: React.ReactElement;
  label: string;
  badge?: number;
  subItems?: NavigationSubItem[];
  group?: string;
}

export const navigationItems: NavigationItem[] = [
  { to: "/dashboard", icon: <Home size={18} />, label: "Dashboard", group: "OVERVIEW" },
  { to: "/projection", icon: <Plus size={18} />, label: "Add Projection", group: "PLANNING" },
  { to: "/dashboard/ppc", icon: <Calendar size={18} />, label: "PPC", group: "PLANNING" },
  { to: "/approvals", icon: <CheckSquare size={18} />, label: "Approvals", group: "PLANNING" },
  { to: "/store", icon: <Package size={18} />, label: "Store", group: "OPERATIONS" },
  { to: "/production", icon: <BarChart2 size={18} />, label: "Production", group: "OPERATIONS" },
  { to: "/finished-goods", icon: <Layers size={18} />, label: "Finished Goods", group: "OPERATIONS" },
  { to: "/container-tracking", icon: <Container size={18} />, label: "Container Tracking", group: "OPERATIONS" },
  { to: "/quality", icon: <ClipboardCheck size={18} />, label: "Quality Control", group: "QUALITY" },
  { to: "/customer-complaints", icon: <MessageSquare size={18} />, label: "Customer Complaints", group: "QUALITY" },
  { to: "/sales", icon: <DollarSign size={18} />, label: "Sales", group: "COMMERCIAL" },
  { to: "/spare-orders", icon: <Wrench size={18} />, label: "Spare Orders", group: "COMMERCIAL" },
  { to: "/rnd", icon: <Lightbulb size={18} />, label: "R&D", group: "INNOVATION" },
  { to: "/management/hr", icon: <Users size={18} />, label: "Human Resources", group: "PEOPLE" },
  { to: "/dash", icon: <Speaker size={18} />, label: "DASH Brand", group: "WORKSPACES" },
];

export const managementItems: NavigationItem[] = [
  { to: "/management/products", icon: <FileText size={18} />, label: "Products" },
  { to: "/management/raw-materials", icon: <Layers size={18} />, label: "Raw Materials" },
  { to: "/management/customers", icon: <UserPlus size={18} />, label: "Customers" },
  { to: "/vendors", icon: <Building2 size={18} />, label: "Vendors" },
  { to: "/management/plants", icon: <Building2 size={18} />, label: "Plants" },
  { to: "/user-management", icon: <User size={18} />, label: "User Management" },
];
