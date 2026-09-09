import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";

export interface TabBarItem {
  id: string;
  label: string;
  count?: number;
  /** When set, the tab behaves as a route link instead of an in-page tab. */
  to?: string;
}

interface TabBarProps {
  tabs: TabBarItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** Sync the active in-page tab to the ?tab= query parameter. Defaults to true. */
  syncToUrl?: boolean;
  /** Query parameter name used when syncing. Defaults to "tab". */
  paramName?: string;
  className?: string;
}

export function TabBar({
  tabs,
  value,
  onChange,
  syncToUrl = true,
  paramName = "tab",
  className,
}: TabBarProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isRouteMode = tabs.some((tab) => Boolean(tab.to));
  const paramValue = searchParams.get(paramName);
  const validIds = tabs.map((tab) => tab.id);

  // On mount (and whenever the URL param changes) adopt the tab named in the URL.
  useEffect(() => {
    if (isRouteMode || !syncToUrl || !onChange) return;
    if (paramValue && validIds.includes(paramValue) && paramValue !== value) {
      onChange(paramValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramValue, isRouteMode, syncToUrl]);

  const handleSelect = (id: string) => {
    onChange?.(id);
    if (!syncToUrl) return;
    const next = new URLSearchParams(searchParams);
    next.set(paramName, id);
    setSearchParams(next, { replace: true });
  };

  const isRouteActive = (to: string) => {
    if (location.pathname === to) return true;
    // Longest matching prefix wins so an "Overview" root tab is not always active.
    const bestMatch = tabs
      .filter((tab) => tab.to && (location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`)))
      .sort((a, b) => (b.to as string).length - (a.to as string).length)[0];
    return bestMatch?.to === to;
  };

  return (
    <div className={cn("pill-tabs", className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.to ? isRouteActive(tab.to) : tab.id === value;
        const inner = (
          <>
            <span>{tab.label}</span>
            {(tab.count ?? 0) > 0 && (
              <span className="rounded-[3px] bg-destructive-wash px-1 font-mono text-[9.5px] font-semibold text-destructive">
                {tab.count}
              </span>
            )}
          </>
        );

        if (tab.to) {
          return (
            <Link
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={isActive}
              className={cn("pill-tab shrink-0", isActive && "active")}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn("pill-tab shrink-0", isActive && "active")}
            onClick={() => handleSelect(tab.id)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
