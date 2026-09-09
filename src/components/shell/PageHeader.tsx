import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  breadcrumb?: PageHeaderBreadcrumb[];
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {

  return (
    <header className={cn("w-full pb-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 && <span className="opacity-45" aria-hidden="true">/</span>}
                {item.to && !isLast ? (
                  <Link className="truncate transition-colors hover:text-foreground" to={item.to} onClick={item.onClick}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={cn("truncate", isLast && "font-mono text-foreground")} aria-current={isLast ? "page" : undefined}>
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-semibold uppercase tracking-[0.085em] text-foreground">{title}</h1>

        </div>
        {(meta || actions) && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {meta && <div className="text-[11px] text-muted-foreground">{meta}</div>}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
