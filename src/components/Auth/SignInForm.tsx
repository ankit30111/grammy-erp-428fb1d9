import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SignInFormProps {
  onForgotPassword?: () => void;
}

export function SignInForm({ onForgotPassword }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // prevent double-submit
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      toast.error("Please enter both email and password.");
      setLoading(false);
      return;
    }

    // Clear stale local auth cache
    try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}

    const attemptSignIn = async (): Promise<{ success: boolean }> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials') ||
              error.message.includes('invalid_credentials')) {
            toast.error("Incorrect email or password. Please check and try again.");
          } else if (error.message.includes('refresh_token_not_found') ||
                     error.message.includes('Invalid Refresh Token')) {
            toast.error("Session expired. Please try signing in again.");
          } else if (error.message.toLowerCase().includes('failed to fetch') ||
                     error.message.toLowerCase().includes('networkerror')) {
            return { success: false }; // signal retry
          } else {
            toast.error(error.message);
          }
          return { success: true }; // handled (don't retry)
        }

        toast.success("Signed in successfully!");
        navigate("/dashboard");
        return { success: true };
      } catch (err) {
        console.error("[Auth] Sign in exception:", err);
        return { success: false }; // retry on unexpected errors
      }
    };

    let result = await attemptSignIn();

    // One automatic retry for network failures
    if (!result.success) {
      console.log("[Auth] First attempt failed, retrying in 1s...");
      await new Promise(r => setTimeout(r, 1000));
      result = await attemptSignIn();
      if (!result.success) {
        toast.error(
          "Network error reaching the server. Please check your internet connection, disable VPN/ad-blockers, or try another network."
        );
      }
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>
      {onForgotPassword && (
        <button
          type="button"
          onClick={onForgotPassword}
          className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
        >
          Forgot your password?
        </button>
      )}
    </form>
  );
}
