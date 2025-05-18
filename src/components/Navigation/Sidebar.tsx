
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BarChart2, Package, Users, ClipboardCheck, Truck, ShoppingCart, Layers, Settings, ChevronRight, ChevronLeft, Home, FileCheck, Bell, Calendar, Plus, Check, Search, X } from "lucide-react";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
  subItems?: {
    to: string;
    label: string;
    badge?: number;
  }[];
}

const NavItem = ({
  to,
  icon,
  label,
  collapsed,
  badge,
  subItems
}: NavItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const handleExpandClick = (e: React.MouseEvent) => {
    if (subItems?.length) {
      e.preventDefault();
      setExpanded(!expanded);
    }
  };
  return <li>
      <NavLink to={to} className={({
      isActive
    }) => cn("nav-link", isActive && !subItems?.length && "active")} onClick={subItems?.length ? handleExpandClick : undefined} end={!subItems?.length}>
        <span className="text-sidebar-foreground">{icon}</span>
        {!collapsed && <>
            <span className="text-sidebar-foreground">{label}</span>
            {subItems?.length && <span className="ml-auto">
                {expanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </span>}
          </>}
        {!collapsed && badge !== undefined && <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
            {badge > 99 ? "99+" : badge}
          </span>}
      </NavLink>
      
      {!collapsed && expanded && subItems?.length && <ul className="ml-8 space-y-1 mt-1">
          {subItems.map((item, index) => <li key={index}>
              <NavLink to={item.to} className={({
          isActive
        }) => cn("nav-link text-sm py-1.5", isActive && "active")}>
                <div className="w-1 h-1 rounded-full bg-current" />
                <span className="text-sidebar-foreground">{item.label}</span>
                {item.badge !== undefined && <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>}
              </NavLink>
            </li>)}
        </ul>}
    </li>;
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return <div className={cn("bg-sidebar h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border", collapsed ? "w-16" : "w-64")}>
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
        {!collapsed && <h1 className="font-bold text-xl text-sidebar-foreground">GRAMMY ERP</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
        <ul className="space-y-1">
          <NavItem to="/" icon={<Home size={20} />} label="Dashboard" collapsed={collapsed} />
          <NavItem to="/projection" icon={<Plus size={20} />} label="Add Projection" collapsed={collapsed} badge={2} />
          <NavItem to="/planning" icon={<Calendar size={20} />} label="Planning (PPC)" collapsed={collapsed} badge={2} />
          <NavItem to="/production" icon={<BarChart2 size={20} />} label="Production" collapsed={collapsed} badge={3} />
          <NavItem to="/quality" icon={<ClipboardCheck size={20} />} label="Quality Control" collapsed={collapsed} badge={5} subItems={[{
          to: "/quality/iqc",
          label: "IQC",
          badge: 3
        }, {
          to: "/quality/pqc",
          label: "PQC",
          badge: 2
        }, {
          to: "/quality/oqc",
          label: "OQC",
          badge: 1
        }]} />
          <NavItem to="/inventory" icon={<Package size={20} />} label="Inventory" collapsed={collapsed} />
          <NavItem to="/purchase" icon={<ShoppingCart size={20} />} label="Purchase" collapsed={collapsed} />
          <NavItem to="/grn" icon={<FileCheck size={20} />} label="GRN" collapsed={collapsed} badge={3} />
          <NavItem to="/dispatch" icon={<Truck size={20} />} label="Dispatch" collapsed={collapsed} />
        </ul>

        <div className={cn(!collapsed && "px-3 pt-2")}>
          {!collapsed && <div className="text-xs font-semibold text-sidebar-foreground/70 mb-2">MANAGEMENT</div>}
          <ul className="space-y-1">
            <NavItem to="/resources" icon={<Users size={20} />} label="Human Resources" collapsed={collapsed} />
            <NavItem to="/management" icon={<Layers size={20} />} label="Management" collapsed={collapsed} subItems={[{
              to: "/management/products",
              label: "Products"
            }, {
              to: "/management/raw-materials",
              label: "Raw Materials"
            }, {
              to: "/management/human-resources",
              label: "HR Management"
            }]} />
            <NavItem to="/bom" icon={<Layers size={20} />} label="BOM Management" collapsed={collapsed} />
            <NavItem to="/reports" icon={<Search size={20} />} label="Reports" collapsed={collapsed} />
            <NavItem to="/notifications" icon={<Bell size={20} />} label="Notifications" collapsed={collapsed} badge={12} />
          </ul>
        </div>
      </nav>

      <div className="p-2 mt-auto border-t border-sidebar-border">
        <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" collapsed={collapsed} />
      </div>
    </div>;
}
