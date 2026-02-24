import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { authStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate("/", { replace: true });
    }
  }, [authStatus, navigate]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
