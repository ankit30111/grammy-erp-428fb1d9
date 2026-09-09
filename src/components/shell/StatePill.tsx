import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatePillProps {
  state: "ok" | "warn" | "bad" | "idle";
  children: ReactNode;
  className?: string;
}

const stateClasses: Record<StatePillProps["state"], string> = {
  ok: "bg-success-wash text-success",
  warn: "bg-warning-wash text-warning",
  bad: "bg-destructive-wash text-destructive",
  idle: "bg-sunken text-muted-foreground",
};

export function StatePill({ state, children, className }: StatePillProps) {
  return <span className={cn("status-badge", stateClasses[state], className)}>{children}</span>;
}
