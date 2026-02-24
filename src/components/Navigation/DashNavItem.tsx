import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DashNavItemProps {
  to: string;
  icon: React.ReactElement;
  label: string;
  collapsed?: boolean;
}

export function DashNavItem({ to, icon, label, collapsed }: DashNavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/dash"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          "hover:bg-white/10",
          isActive
            ? "bg-white/15 text-white"
            : "text-slate-300"
        )
      }
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}
