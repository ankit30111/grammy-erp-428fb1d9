import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SignInForm } from "./SignInForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function AuthPage() {
  const { authStatus } = useAuth();
  const navigate = useNavigate();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate("/dashboard", { replace: true });
    }
  }, [authStatus, navigate]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (authStatus === 'authenticated') {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png"
            alt="Grammy Electronics"
          />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to Grammy Electronics
          </h2>
          <p className="mt-2 text-sm text-gray-600">
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
