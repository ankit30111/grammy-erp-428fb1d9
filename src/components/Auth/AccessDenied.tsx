import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AccessDeniedProps {
  /** What the user was trying to see/do, e.g. "Material Requests" or "Purchase Orders". */
  area: string;
  /** Optional override for the explanation line. */
  message?: string;
  /** Compact (in-card) variant — used when AccessDenied is rendered inside an existing layout. */
  variant?: "page" | "inline";
  /** Email shown for the "Contact Admin" CTA. */
  adminEmail?: string;
}

/**
 * Shown whenever an RLS-denied query/mutation is detected. Replaces the old
 * "Loading…" spinners that used to spin forever and the generic "Failed to
 * fetch" toasts that gave users no useful information.
 */
export function AccessDenied({
  area,
  message,
  variant = "inline",
  adminEmail = "ankitm@grammyelectronics.com",
}: AccessDeniedProps) {
  const { userProfile } = useAuth();

  const explanation =
    message ??
    `Your account does not have permission to access ${area}. This is controlled by your department membership.`;

  const subject = encodeURIComponent(`Access request: ${area}`);
  const body = encodeURIComponent(
    `Hi,\n\nPlease grant my account access to "${area}".\n\nUser: ${userProfile?.full_name || userProfile?.email || "(unknown)"}\nEmail: ${userProfile?.email || "(unknown)"}\nDepartment: ${userProfile?.departments?.name || "(none assigned)"}\n\nThanks.`,
  );

  const card = (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <ShieldAlert className="h-12 w-12 text-amber-500" />
        </div>
        <CardTitle>Access Denied</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">{explanation}</p>
        {userProfile && (
          <div className="p-3 bg-muted rounded-md text-sm space-y-1">
            <div className="font-medium">
              {userProfile.full_name || userProfile.email}
            </div>
            {userProfile.departments?.name && (
              <div className="text-muted-foreground">
                Department: {userProfile.departments.name}
              </div>
            )}
          </div>
        )}
        <Button asChild variant="outline" className="gap-2">
          <a href={`mailto:${adminEmail}?subject=${subject}&body=${body}`}>
            <Mail className="h-4 w-4" />
            Request access from admin
          </a>
        </Button>
      </CardContent>
    </Card>
  );

  if (variant === "page") {
    return <div className="container mx-auto py-8">{card}</div>;
  }

  return <div className="py-6">{card}</div>;
}
