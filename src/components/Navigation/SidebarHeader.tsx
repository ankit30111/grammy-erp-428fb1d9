
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const SidebarHeader = ({ collapsed, onToggle }: SidebarHeaderProps) => {
  return (
    <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
      {!collapsed ? (
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
            G
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground truncate">Grammy ERP</span>
        </div>
      ) : (
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mx-auto">
          G
        </div>
      )}
      <button
        onClick={onToggle}
        className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-accent-foreground transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </div>
  );
};
