import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { AccessDenied } from '@/components/Auth/AccessDenied';

interface AdminGuardProps {
  children: ReactNode;
  /**
   * If provided, the user must ALSO have permission for the named module
   * (via department_permissions). Use this for pages where being "admin" by
   * role isn't enough — a department-scoped admin shouldn't necessarily
   * see another department's data. Leave undefined for pure role-only gates
   * like global User Management.
   */
  requireModule?: string;
  /** Friendly area name for AccessDenied if requireModule fails. */
  moduleArea?: string;
}

export function AdminGuard({ children, requireModule, moduleArea }: AdminGuardProps) {
  const { loading, isAdmin, userProfile, canAccessModule } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Checking permissions...</span>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">User Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Your user profile could not be found. Please contact your system administrator.
            </p>
            <p className="text-xs text-muted-foreground">
              You may need to be added to the user management system.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              You need administrator privileges to access this page.
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Current User</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {userProfile.full_name || userProfile.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Role: {userProfile.role || 'Unknown'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Please contact your system administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Role passed; if a specific module is also required, defer to the
  // department-permissions check (auth_user_can_access_module via context).
  if (requireModule && !canAccessModule(requireModule)) {
    return <AccessDenied area={moduleArea ?? requireModule} variant="page" />;
  }

  return <>{children}</>;
}
