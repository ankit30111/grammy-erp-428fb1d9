import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BackendUnreachable } from "./BackendUnreachable";
import { Loader2 } from "lucide-react";
import { checkSupabaseConnectivity, ConnectivityResult } from "@/utils/supabaseConnectivity";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { authStatus } = useAuth();
  const navigate = useNavigate();
  const [connectivity, setConnectivity] = useState<ConnectivityResult | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const result = await checkSupabaseConnectivity();
    setConnectivity(result);
    setChecking(false);
  }, []);

  // If auth stays loading for 8s, check connectivity
  useEffect(() => {
    if (authStatus !== 'loading') return;
    const timer = setTimeout(() => {
      runCheck();
    }, 8000);
    return () => clearTimeout(timer);
  }, [authStatus, runCheck]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate("/", { replace: true });
    }
  }, [authStatus, navigate]);

  if (authStatus === 'loading') {
    // If connectivity check ran and backend is down, show diagnostics
    if (connectivity && !connectivity.reachable) {
      return <BackendUnreachable result={connectivity} onRetry={runCheck} retrying={checking} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') return null;

  return <>{children}</>;
}
