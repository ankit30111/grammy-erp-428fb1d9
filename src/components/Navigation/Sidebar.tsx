
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NavItem } from "./NavItem";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarFooter } from "./SidebarFooter";
import { navigationItems, managementItems } from "./navigationConfig";
import { useSidebarAuth } from "./useSidebarAuth";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { userPermissions, allowedTabs, isLoading } = useSidebarAuth();
  
  return (
    <div className={cn("bg-sidebar h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border", collapsed ? "w-16" : "w-64")}>
      <SidebarHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <nav className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              allowedTabs={allowedTabs}
              subItems={item.subItems}
              badge={item.badge}
            />
          ))}
        </ul>

        <div className={cn("space-y-2", !collapsed && "px-2 pt-3")}>
          <div className="h-px bg-sidebar-border mx-1" /> {/* Divider */}
          
          {!collapsed && (
            <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 px-3 py-1">
              MANAGEMENT
            </div>
          )}
          
          <ul className="space-y-1">
            {managementItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                allowedTabs={allowedTabs}
                badge={item.badge}
              />
            ))}
          </ul>
        </div>
      </nav>

      <SidebarFooter 
        collapsed={collapsed} 
        allowedTabs={allowedTabs} 
        userPermissions={userPermissions} 
        isLoading={isLoading} 
      />
    </div>
  );
}
