
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft } from "lucide-react";

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

export const NavItem = ({
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
