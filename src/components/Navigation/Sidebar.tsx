
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BarChart2, Package, Users, ClipboardCheck, Truck, ShoppingCart, Layers, Settings, ChevronRight, ChevronLeft, Home, FileCheck, Bell, Calendar, Plus, Check, Search, X, Archive, FileText, User, Database, UserPlus, Building2 } from "lucide-react";

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
        {!collapsed ? <div className="flex items-center">
            <img alt="Grammy Electronics Logo" src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png" className="h-10 mr-2 object-scale-down" />
            <h1 className="font-bold text-lg text-sidebar-foreground">
        </h1>
          </div> : <img src="https://grammyelectronics.com/wp-content/uploads/2023/10/logo-1.png" alt="Grammy Electronics Logo" className="h-8 mx-auto" />}
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
        <ul className="space-y-1">
          <NavItem to="/" icon={<Home size={20} />} label="Dashboard" collapsed={collapsed} />
          <NavItem to="/projection" icon={<Plus size={20} />} label="Add Projection" collapsed={collapsed} />
          
          <NavItem to="/planning" icon={<Calendar size={20} />} label="PPC" collapsed={collapsed} subItems={[{
          to: "/planning",
          label: "Planning"
        }, {
          to: "/purchase",
          label: "Purchase"
        }, {
          to: "/grn",
          label: "GRN",
          badge: 3
        }]} />
          
          <NavItem to="/inventory" icon={<Package size={20} />} label="Store" collapsed={collapsed} />
          <NavItem to="/production" icon={<BarChart2 size={20} />} label="Production" collapsed={collapsed} />
          <NavItem to="/finished-goods" icon={<Layers size={20} />} label="Finished Goods" collapsed={collapsed} />
          
          <NavItem to="/quality" icon={<ClipboardCheck size={20} />} label="Quality Control" collapsed={collapsed} subItems={[{
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
          
          <NavItem to="/dispatch" icon={<Truck size={20} />} label="Dispatch" collapsed={collapsed} />
          <NavItem to="/spare-orders" icon={<Archive size={20} />} label="Spare Orders" collapsed={collapsed} />
          <NavItem to="/resources" icon={<Users size={20} />} label="Human Resources" collapsed={collapsed} />
        </ul>

        <div className={cn("space-y-2", !collapsed && "px-2 pt-3")}>
          <div className="h-px bg-sidebar-border mx-1" /> {/* Divider */}
          
          {!collapsed && <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 px-3 py-1">
              MANAGEMENT
            </div>}
          
          <ul className="space-y-1">
            <NavItem to="/management/products" icon={<FileText size={20} />} label="Products" collapsed={collapsed} />
            <NavItem to="/management/raw-materials" icon={<Layers size={20} />} label="Raw Materials" collapsed={collapsed} />
            <NavItem to="/vendors" icon={<Building2 size={20} />} label="Vendors" collapsed={collapsed} />
          </ul>
        </div>
      </nav>

      <div className="p-2 mt-auto border-t border-sidebar-border">
        <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" collapsed={collapsed} />
      </div>
    </div>;
}
