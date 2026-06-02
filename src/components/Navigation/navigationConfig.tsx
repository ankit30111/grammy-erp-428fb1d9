
import { Home, Plus, Wrench, Calendar, Package, BarChart2, Layers, ClipboardCheck, DollarSign, Users, FileText, UserPlus, Building2, MessageSquare, CheckSquare, Lightbulb, Container, Speaker, ShieldCheck } from "lucide-react";

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
  /** Module key required to see this item. Omit for items everyone can see. */
  module?: string;
  /** If true, only admins see this item. */
  adminOnly?: boolean;
}

export const navigationItems: NavigationItem[] = [
  { to: "/dashboard", icon: <Home size={18} />, label: "Dashboard", group: "OVERVIEW" },
  { to: "/approvals", icon: <CheckSquare size={18} />, label: "Approvals", group: "OVERVIEW", module: "approvals" },
  // Commerce bundle: purchase + planning + sales + imports
  { to: "/projection", icon: <Plus size={18} />, label: "Add Projection", group: "COMMERCE", module: "commerce" },
  { to: "/dashboard/ppc", icon: <Calendar size={18} />, label: "PPC", group: "COMMERCE", module: "commerce" },
  { to: "/purchase", icon: <FileText size={18} />, label: "Purchase", group: "COMMERCE", module: "commerce" },
  { to: "/sales", icon: <DollarSign size={18} />, label: "Sales", group: "COMMERCE", module: "commerce" },
  { to: "/spare-orders", icon: <Wrench size={18} />, label: "Spare Orders", group: "COMMERCE", module: "commerce" },
  { to: "/container-tracking", icon: <Container size={18} />, label: "Container Tracking", group: "COMMERCE", module: "commerce" },
  // Store
  { to: "/store", icon: <Package size={18} />, label: "Store", group: "STORE", module: "store" },
  // Production
  { to: "/production", icon: <BarChart2 size={18} />, label: "Production", group: "PRODUCTION", module: "production" },
  { to: "/finished-goods", icon: <Layers size={18} />, label: "Finished Goods", group: "PRODUCTION", module: "production" },
  // Quality
  { to: "/quality", icon: <ClipboardCheck size={18} />, label: "Quality Control", group: "QUALITY", module: "quality" },
  { to: "/customer-complaints", icon: <MessageSquare size={18} />, label: "Customer Complaints", group: "QUALITY", module: "quality" },
  // R&D
  { to: "/rnd", icon: <Lightbulb size={18} />, label: "R&D", group: "R&D", module: "rnd" },
  // DASH
  { to: "/dash", icon: <Speaker size={18} />, label: "DASH Brand", group: "WORKSPACES", module: "dash" },
];

export const managementItems: NavigationItem[] = [
  { to: "/management/products", icon: <FileText size={18} />, label: "Products", adminOnly: true },
  { to: "/management/raw-materials", icon: <Layers size={18} />, label: "Raw Materials", adminOnly: true },
  { to: "/management/customers", icon: <UserPlus size={18} />, label: "Customers", adminOnly: true },
  { to: "/vendors", icon: <Building2 size={18} />, label: "Vendors", adminOnly: true },
  { to: "/management/plants", icon: <Building2 size={18} />, label: "Plants", adminOnly: true },
  { to: "/management/hr", icon: <Users size={18} />, label: "Human Resources", module: "hr" },
  { to: "/management/access-control", icon: <ShieldCheck size={18} />, label: "Users & Access", adminOnly: true },
];
