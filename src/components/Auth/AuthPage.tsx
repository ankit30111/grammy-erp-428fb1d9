
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SignInForm } from "./SignInForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function AuthPage() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      // Race getSession against a 5s timeout
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);

        if (!mounted) return;

        if (!result) {
          // Timed out
          console.warn('Auth check timed out, clearing stale data');
          try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}
          setLoading(false);
          return;
        }

        const { data: { session }, error } = result;
        console.log('Auth page - checking session:', session?.user?.id || 'no session');
        
        if (error) {
          console.error('Auth check error:', error);
          if (error.message.includes('refresh_token_not_found') || 
              error.message.includes('Invalid Refresh Token')) {
            try { await supabase.auth.signOut(); } catch (_) {}
          }
        } else if (session && mounted) {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error('Unexpected auth error:', error);
        try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth changes with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log(`Auth page - Auth state change: ${event}`, session?.user?.id || 'no session');
        
        if (event === 'SIGNED_IN' && session) {
          navigate("/dashboard");
        } else if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed on auth page');
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
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
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
