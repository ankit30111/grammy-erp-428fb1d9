import { cn } from "@/lib/utils";

export interface TabBarItem {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: TabBarItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TabBar({ tabs, value, onChange, className }: TabBarProps) {
  return (
    <div className={cn("pill-tabs w-full", className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn("pill-tab shrink-0", isActive && "active")}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            {(tab.count ?? 0) > 0 && (
              <span className="rounded-[3px] bg-destructive-wash px-1 font-mono text-[9.5px] font-semibold text-destructive">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
