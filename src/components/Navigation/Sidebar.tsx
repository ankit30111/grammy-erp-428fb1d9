
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BarChart2, Package, Users, ClipboardCheck, Truck, ShoppingCart, Layers, Settings, ChevronRight, ChevronLeft, Home, FileCheck, Bell, Calendar, Plus, Check, Search, X, Archive, FileText, User, Database, UserPlus, Building2, Wrench, DollarSign, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  allowedTabs?: string[];
}

const NavItem = ({
  to,
  icon,
  label,
  collapsed,
  badge,
  subItems,
  allowedTabs = []
}: NavItemProps) => {
  const [expanded, setExpanded] = useState(false);
  
  // Extract the tab name from the route
  const tabName = to.substring(1) || "dashboard"; // Remove leading slash, default to dashboard
  
  // Check if this tab is allowed for the current user
  const isAllowed = allowedTabs.length === 0 || allowedTabs.includes(tabName) || tabName === "dashboard";
  
  // Filter subItems based on permissions
  const filteredSubItems = subItems?.filter(item => {
    const subTabName = item.to.substring(1);
    return allowedTabs.includes(subTabName);
  });
  
  if (!isAllowed && (!filteredSubItems || filteredSubItems.length === 0)) {
    return null;
  }
  
  const handleExpandClick = (e: React.MouseEvent) => {
    if (filteredSubItems?.length) {
      e.preventDefault();
      setExpanded(!expanded);
    }
  };
  
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn("nav-link", isActive && !filteredSubItems?.length && "active")
        }
        onClick={filteredSubItems?.length ? handleExpandClick : undefined}
        end={!filteredSubItems?.length}
      >
        <span className="text-sidebar-foreground">{icon}</span>
        {!collapsed && (
          <>
            <span className="text-sidebar-foreground">{label}</span>
            {filteredSubItems?.length && (
              <span className="ml-auto">
                {expanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </span>
            )}
          </>
        )}
        {!collapsed && badge !== undefined && (
          <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </NavLink>
      
      {!collapsed && expanded && filteredSubItems?.length && (
        <ul className="ml-8 space-y-1 mt-1">
          {filteredSubItems.map((item, index) => (
            <li key={index}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn("nav-link text-sm py-1.5", isActive && "active")
                }
              >
                <div className="w-1 h-1 rounded-full bg-current" />
                <span className="text-sidebar-foreground">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    
    getCurrentUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Get user permissions based on their department
  const { data: userPermissions, isLoading } = useUserPermissions(userId);
  
  // Type guard to ensure userPermissions has the correct structure
  const allowedTabs = userPermissions && typeof userPermissions === 'object' && 'allowedTabs' in userPermissions 
    ? userPermissions.allowedTabs 
    : [];
  
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Error signing out");
        return;
      }
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("An unexpected error occurred");
    }
  };
  
  return (
    <div className={cn("bg-sidebar h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border", collapsed ? "w-16" : "w-64")}>
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center">
            <img
              alt="Grammy Electronics Logo"
              src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png"
              className="h-10 mr-2 object-scale-down"
            />
            <h1 className="font-bold text-lg text-sidebar-foreground"></h1>
          </div>
        ) : (
          <img
            src="https://grammyelectronics.com/wp-content/uploads/2023/10/logo-1.png"
            alt="Grammy Electronics Logo"
            className="h-8 mx-auto"
          />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
        <ul className="space-y-1">
          <NavItem to="/" icon={<Home size={20} />} label="Dashboard" collapsed={collapsed} allowedTabs={allowedTabs} />
          <NavItem to="/projection" icon={<Plus size={20} />} label="Add Projection" collapsed={collapsed} allowedTabs={allowedTabs} />
          <NavItem to="/spare-orders" icon={<Wrench size={20} />} label="Spare Orders" collapsed={collapsed} allowedTabs={allowedTabs} />
          
          <NavItem
            to="#"
            icon={<Calendar size={20} />}
            label="PPC"
            collapsed={collapsed}
            allowedTabs={allowedTabs}
            subItems={[
              { to: "/planning", label: "Planning" },
              { to: "/purchase", label: "Purchase" },
              { to: "/grn", label: "GRN", badge: 3 }
            ]}
          />
          
          <NavItem to="/inventory" icon={<Package size={20} />} label="Store" collapsed={collapsed} allowedTabs={allowedTabs} />
          <NavItem to="/production" icon={<BarChart2 size={20} />} label="Production" collapsed={collapsed} allowedTabs={allowedTabs} />
          <NavItem to="/finished-goods" icon={<Layers size={20} />} label="Finished Goods" collapsed={collapsed} allowedTabs={allowedTabs} />
          
          <NavItem
            to="/quality"
            icon={<ClipboardCheck size={20} />}
            label="Quality Control"
            collapsed={collapsed}
            allowedTabs={allowedTabs}
            subItems={[
              { to: "/quality/iqc", label: "IQC", badge: 3 },
              { to: "/quality/pqc", label: "PQC", badge: 2 },
              { to: "/quality/oqc", label: "OQC", badge: 1 }
            ]}
          />
          
          <NavItem
            to="/sales"
            icon={<DollarSign size={20} />}
            label="Sales"
            collapsed={collapsed}
            allowedTabs={allowedTabs}
            subItems={[
              { to: "/sales/spare-dispatch", label: "Spare Dispatch" },
              { to: "/dispatch", label: "Regular Dispatch" }
            ]}
          />

          <NavItem to="/hr-management" icon={<Users size={20} />} label="Human Resources" collapsed={collapsed} allowedTabs={allowedTabs} />
        </ul>

        <div className={cn("space-y-2", !collapsed && "px-2 pt-3")}>
          <div className="h-px bg-sidebar-border mx-1" /> {/* Divider */}
          
          {!collapsed && (
            <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 px-3 py-1">
              MANAGEMENT
            </div>
          )}
          
          <ul className="space-y-1">
            <NavItem to="/management/products" icon={<FileText size={20} />} label="Products" collapsed={collapsed} allowedTabs={allowedTabs} />
            <NavItem to="/management/raw-materials" icon={<Layers size={20} />} label="Raw Materials" collapsed={collapsed} allowedTabs={allowedTabs} />
            <NavItem to="/management/customers" icon={<UserPlus size={20} />} label="Customers" collapsed={collapsed} allowedTabs={allowedTabs} />
            <NavItem to="/vendors" icon={<Building2 size={20} />} label="Vendors" collapsed={collapsed} allowedTabs={allowedTabs} />
            <NavItem to="/user-management" icon={<User size={20} />} label="User Management" collapsed={collapsed} allowedTabs={allowedTabs} />
          </ul>
        </div>
      </nav>

      <div className="p-2 mt-auto border-t border-sidebar-border space-y-2">
        <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" collapsed={collapsed} allowedTabs={allowedTabs} />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn("w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent", collapsed && "justify-center px-2")}
        >
          <LogOut size={20} />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
      
      {/* Show current user department if not collapsed */}
      {!collapsed && userPermissions && typeof userPermissions === 'object' && 'departmentName' in userPermissions && !isLoading && (
        <div className="p-2 text-xs text-sidebar-foreground/60 border-t border-sidebar-border">
          Department: {userPermissions.departmentName}
        </div>
      )}
    </div>
  );
}
