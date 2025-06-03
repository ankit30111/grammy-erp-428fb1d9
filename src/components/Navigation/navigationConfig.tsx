
import { 
  Home, 
  Package, 
  Users, 
  ShoppingCart, 
  Package2, 
  BarChart3, 
  FileText, 
  Calendar,
  Settings,
  UserCheck,
  ClipboardCheck,
  Truck,
  MessageSquare
} from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface NavigationItem {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string | number;
  subItems?: Array<{
    to: string;
    label: string;
  }>;
}

export const navigationItems: NavigationItem[] = [
  {
    to: "/",
    icon: Home,
    label: "Home",
  },
  {
    to: "/projections",
    icon: BarChart3,
    label: "Projections",
  },
  {
    to: "/planning",
    icon: Calendar,
    label: "Planning",
  },
  {
    to: "/ppc",
    icon: Settings,
    label: "PPC",
  },
  {
    to: "/store",
    icon: Package,
    label: "Store",
  },
  {
    to: "/production",
    icon: Package2,
    label: "Production",
  },
  {
    to: "/quality",
    icon: ClipboardCheck,
    label: "Quality",
    subItems: [
      { to: "/quality/iqc", label: "IQC" },
      { to: "/quality/pqc", label: "PQC" },
      { to: "/quality/oqc", label: "OQC" },
    ]
  },
  {
    to: "/dispatch",
    icon: Truck,
    label: "Dispatch",
  },
  {
    to: "/customer-complaints",
    icon: MessageSquare,
    label: "Customer Complaints",
  },
];

export const managementItems: NavigationItem[] = [
  {
    to: "/purchase",
    icon: ShoppingCart,
    label: "Purchase",
  },
  {
    to: "/vendors",
    icon: Users,
    label: "Vendors",
  },
  {
    to: "/inventory",
    icon: Package,
    label: "Inventory",
  },
  {
    to: "/finished-goods",
    icon: Package2,
    label: "Finished Goods",
  },
  {
    to: "/spare-orders",
    icon: FileText,
    label: "Spare Orders",
  },
  {
    to: "/management",
    icon: Settings,
    label: "Management",
  },
  {
    to: "/user-management",
    icon: UserCheck,
    label: "User Management",
  },
];
