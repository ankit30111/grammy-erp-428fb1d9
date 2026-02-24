import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SignInForm } from "./SignInForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { BackendUnreachable } from "./BackendUnreachable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { checkSupabaseConnectivity, ConnectivityResult } from "@/utils/supabaseConnectivity";

export function AuthPage() {
  const { authStatus } = useAuth();
  const navigate = useNavigate();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityResult | null>(null);
  const [checkingConnectivity, setCheckingConnectivity] = useState(true);

  const runCheck = useCallback(async () => {
    setCheckingConnectivity(true);
    const result = await checkSupabaseConnectivity();
    setConnectivity(result);
    setCheckingConnectivity(false);
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate("/dashboard", { replace: true });
    }
  }, [authStatus, navigate]);

  if (authStatus === 'authenticated') return null;

  // Still running first connectivity check
  if (checkingConnectivity && !connectivity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Checking backend connectivity…</span>
      </div>
    );
  }

  // Backend unreachable
  if (connectivity && !connectivity.reachable) {
    return <BackendUnreachable result={connectivity} onRetry={runCheck} retrying={checkingConnectivity} />;
  }

  // Auth still loading (backend is reachable)
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png"
            alt="Grammy Electronics"
          />
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            Welcome to Grammy Electronics
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manufacturing Management System
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {showForgotPassword ? "Reset Password" : "Sign In"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
            ) : (
              <SignInForm onForgotPassword={() => setShowForgotPassword(true)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
