import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  department_id?: string;
  departments?: {
    name: string;
  };
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authStatus: AuthStatus;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 6000;
const PROFILE_TIMEOUT_MS = 10000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [fetchingProfile, setFetchingProfile] = useState(false);

  const isAdmin = userProfile?.role === 'admin';
  const loading = authStatus === 'loading';

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (fetchingProfile) return;
    setFetchingProfile(true);
    console.log('[Auth] Fetching profile for:', userId);

    const timeoutId = setTimeout(() => {
      console.warn('[Auth] Profile fetch timed out');
      setFetchingProfile(false);
      // Don't block auth – user is authenticated even without profile
      setAuthStatus('authenticated');
    }, PROFILE_TIMEOUT_MS);

    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select(`*, departments (name)`)
        .eq('id', userId)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error('[Auth] Profile fetch error:', error);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Auth] Profile fetch exception:', error);
      setUserProfile(null);
    } finally {
      setFetchingProfile(false);
      setAuthStatus('authenticated');
    }
  }, [fetchingProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
    }
    setUser(null);
    setSession(null);
    setUserProfile(null);
    setAuthStatus('unauthenticated');
  }, []);

  useEffect(() => {
    let mounted = true;

    console.log('[Auth] Initializing...');

    // Safety timeout – always resolve loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && authStatus === 'loading') {
        console.warn('[Auth] Init timed out, forcing unauthenticated');
        try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setAuthStatus('unauthenticated');
      }
    }, AUTH_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        console.log(`[Auth] State change: ${event}`, currentSession?.user?.email || 'no user');

        if (event === 'SIGNED_OUT' || !currentSession) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
          return;
        }

        setSession(currentSession);
        setUser(currentSession.user);

        if (currentSession.user) {
          setTimeout(() => {
            if (mounted) fetchUserProfile(currentSession.user.id);
          }, 0);
        } else {
          setAuthStatus('unauthenticated');
        }
      }
    );

    // Kick off initial session check
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('[Auth] getSession error:', error);
        try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}
        setAuthStatus('unauthenticated');
      }
      // onAuthStateChange handles the rest
    }).catch((error) => {
      if (!mounted) return;
      console.error('[Auth] getSession exception:', error);
      try { localStorage.removeItem('supabase.auth.token'); } catch (_) {}
      setAuthStatus('unauthenticated');
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, userProfile, loading, authStatus, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
