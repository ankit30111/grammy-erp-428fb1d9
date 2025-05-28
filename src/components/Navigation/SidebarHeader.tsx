
import { ChevronRight, ChevronLeft } from "lucide-react";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const SidebarHeader = ({ collapsed, onToggle }: SidebarHeaderProps) => {
  return (
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
        onClick={onToggle}
        className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );
};
