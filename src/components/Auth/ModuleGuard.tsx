import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/Auth/AccessDenied";

interface ModuleGuardProps {
  /** Module name as defined in department_permissions.tab_name. */
  module: string;
  /** Friendly area name shown in the AccessDenied card, e.g. "Purchase Orders". */
  area: string;
  children: ReactNode;
  /** Optional: render this instead of AccessDenied when access is denied. */
  fallback?: ReactNode;
}

/**
 * Route/section gate that defers to the DB's permission model
 * (auth_user_can_access_module). Sibling of AdminGuard but for non-admin
 * department-scoped modules. Wrap top-level page content with this so we fail
 * fast and explicitly instead of letting individual queries 403/empty out.
 */
export function ModuleGuard({ module, area, children, fallback }: ModuleGuardProps) {
  const { loading, userProfile, canAccessModule } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Checking access…</span>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <AccessDenied
        area={area}
        message="Your user profile could not be loaded. Please sign out and sign back in, or contact your administrator."
        variant="page"
      />
    );
  }

  if (!canAccessModule(module)) {
    return fallback ?? <AccessDenied area={area} variant="page" />;
  }

  return <>{children}</>;
}
