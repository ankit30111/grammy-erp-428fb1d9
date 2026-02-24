import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Factory, Warehouse, ShoppingCart,
  Users, Truck, Wrench, Settings, BarChart3, ChevronLeft, ChevronRight, ArrowLeft, Speaker
} from "lucide-react";
import { DashNavItem } from "./DashNavItem";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const dashNavItems = [
  { to: "/dash", icon: <LayoutDashboard size={20} />, label: "DASH Dashboard" },
  { to: "/dash/sales", icon: <ShoppingCart size={20} />, label: "Sales Orders" },
  { to: "/dash/factory-orders", icon: <Factory size={20} />, label: "Factory Orders" },
  { to: "/dash/inventory", icon: <Warehouse size={20} />, label: "Inventory" },
  { to: "/dash/customers", icon: <Users size={20} />, label: "Customers" },
  { to: "/dash/tracking", icon: <Truck size={20} />, label: "Dispatch Tracking" },
  { to: "/dash/products", icon: <Package size={20} />, label: "Product Master" },
  { to: "/dash/spares", icon: <Settings size={20} />, label: "Spare Parts" },
  { to: "/dash/service", icon: <Wrench size={20} />, label: "Service & Warranty" },
];

export function DashSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <aside
      className={`flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10 shrink-0">
        <Speaker className="h-7 w-7 text-violet-400 shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
            DASH
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-white/10 text-slate-400"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {dashNavItems.map((item) => (
          <DashNavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 space-y-2 shrink-0">
        <Separator className="bg-white/10" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/10 px-3"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm">Back to Grammy ERP</span>}
        </Button>
      </div>
    </aside>
  );
}
