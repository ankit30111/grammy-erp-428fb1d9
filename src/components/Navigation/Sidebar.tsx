
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NavItem } from "./NavItem";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarFooter } from "./SidebarFooter";
import { navigationItems, managementItems, NavigationItem } from "./navigationConfig";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const allowedTabs: string[] = [];
  const userPermissions = null;
  const isLoading = false;

  const grouped = useMemo(() => {
    const groups = new Map<string, NavigationItem[]>();
    for (const item of navigationItems) {
      const key = item.group ?? "OTHER";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, []);

  return (
    <div
      className={cn(
        "bg-sidebar h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {grouped.map(([group, items]) => (
          <div key={group} className="space-y-0.5">
            {!collapsed && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-3 py-1.5">
                {group}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
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
          </div>
        ))}

        <div className="space-y-0.5">
          {!collapsed && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-3 py-1.5">
              MANAGEMENT
            </div>
          )}
          <ul className="space-y-0.5">
            {managementItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                allowedTabs={allowedTabs}
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
