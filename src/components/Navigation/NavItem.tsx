
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  
  // Universal access - all items are always allowed
  const isAllowed = true;
  
  // All subItems are always visible in universal access mode
  const filteredSubItems = subItems;
  
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
          cn("nav-link group", isActive && !filteredSubItems?.length && "active", collapsed && "justify-center")
        }
        onClick={filteredSubItems?.length ? handleExpandClick : undefined}
        end={!filteredSubItems?.length}
      >
        <span className="shrink-0">{icon}</span>
        {!collapsed && (
          <>
            <span className="truncate">{label}</span>
            {filteredSubItems?.length && (
              <span className="ml-auto text-sidebar-foreground/40">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
          </>
        )}
        {!collapsed && badge !== undefined && (
          <span className="ml-auto bg-primary/10 text-primary text-[10px] font-semibold rounded-full px-2 py-0.5">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </NavLink>
      
      {!collapsed && expanded && filteredSubItems?.length && (
        <ul className="ml-7 space-y-0.5 mt-1 border-l border-sidebar-border pl-2">
          {filteredSubItems.map((item, index) => (
            <li key={index}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn("nav-link text-sm py-1.5", isActive && "active")
                }
              >
                <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto bg-primary/10 text-primary text-[10px] font-semibold rounded-full px-2 py-0.5">
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
