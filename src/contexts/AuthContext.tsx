import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthExpiredError } from '@/lib/permissions';

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

/**
 * Canonical list of modules. Must stay in sync with the seed in
 * supabase/migrations-pending/001_access_control_foundation.sql and the
 * bucketing in 002_consolidate_rls_policies.sql.
 */
export const KNOWN_MODULES = [
  'core',
  'quality',
  'purchase',
  'store',
  'production',
  'planning',
  'rnd',
  'hr',
  'sales',
  'imports',
  'approvals',
  'dash',
] as const;

export type ModuleName = (typeof KNOWN_MODULES)[number];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  /** Modules this user has access to. Empty set while loading or if no access. */
  permittedModules: Set<string>;
  /** True if the user can access the given module (admin always true). */
  canAccessModule: (module: string) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isDev = import.meta.env.DEV;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permittedModules, setPermittedModules] = useState<Set<string>>(new Set());
  const fetchingProfileRef = useRef(false);

  const isAdmin = userProfile?.role === 'admin';

  const fetchUserProfile = useCallback(async (userId: string) => {
    // Prevent multiple simultaneous profile fetches
    if (fetchingProfileRef.current) {
      if (isDev) console.log('Profile fetch already in progress, skipping...');
      return;
    }

    fetchingProfileRef.current = true;
    if (isDev) console.log('Fetching user profile for:', userId);

    // Safety timeout in case the request hangs (e.g. cold-started DB)
    const timeoutId = setTimeout(() => {
      if (isDev) console.warn('Profile fetch timed out after 10 seconds');
      fetchingProfileRef.current = false;
      setLoading(false);
    }, 10000);

    try {
      // Use the SECURITY DEFINER RPC instead of selecting from user_accounts
      // directly — the role column is now revoked from authenticated, so a
      // direct SELECT would silently omit it (and isAdmin would always be false).
      const { data, error } = await supabase
        .rpc('get_my_profile')
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        if (isDev) console.error('Error fetching user profile:', error);
        // If the auth token expired mid-fetch, sign out cleanly so the user
        // sees the auth screen instead of a half-loaded UI.
        if (isAuthExpiredError(error)) {
          await supabase.auth.signOut();
          setUserProfile(null);
          setPermittedModules(new Set());
          return;
        }
        setUserProfile(null);
      } else if (data) {
        if (isDev) console.log('User profile found');
        // Reshape RPC result so it matches the legacy nested-departments shape
        // the rest of the app expects.
        setUserProfile({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          is_active: data.is_active,
          department_id: data.department_id ?? undefined,
          departments: data.department_name
            ? { name: data.department_name }
            : undefined,
        });
      } else {
        if (isDev) console.warn('No user profile found for user:', userId);
        setUserProfile(null);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (isDev) console.error('Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      fetchingProfileRef.current = false;
      setLoading(false);
    }
  }, []);

  /**
   * Probe each known module via the SECURITY DEFINER function the DB exposes
   * (`auth_user_can_access_module`). One round trip per module, in parallel —
   * 12 small RPC calls, < 100ms total in practice.
   *
   * Done client-side rather than by reading department_permissions directly
   * because the DB function is the single source of truth and already handles
   * the admin-bypass case.
   */
  const fetchPermittedModules = useCallback(async () => {
    try {
      const results = await Promise.all(
        KNOWN_MODULES.map(async (mod) => {
          const { data, error } = await supabase.rpc('auth_user_can_access_module', {
            module_name: mod,
          });
          if (error) {
            if (isDev) console.warn(`Module probe failed for "${mod}":`, error.message);
            return [mod, false] as const;
          }
          return [mod, Boolean(data)] as const;
        }),
      );
      const allowed = new Set<string>(
        results.filter(([, ok]) => ok).map(([mod]) => mod),
      );
      setPermittedModules(allowed);
    } catch (error) {
      if (isDev) console.error('Failed to load permitted modules:', error);
      setPermittedModules(new Set());
    }
  }, []);

  const canAccessModule = useCallback(
    (module: string): boolean => {
      // Admin role short-circuit — matches the DB's auth_is_admin() behavior.
      if (userProfile?.role === 'admin') return true;
      return permittedModules.has(module);
    },
    [userProfile?.role, permittedModules],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      if (isDev) console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setSession(null);
      setUserProfile(null);
      setPermittedModules(new Set());
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return;

        if (isDev) console.log(`Auth state change: ${event}`);

        // Token refresh failure → backend rejected our refresh token. Tear
        // everything down so we don't leave the user in a half-authed state.
        if (event === 'TOKEN_REFRESHED' && !nextSession) {
          if (isDev) console.warn('Token refresh returned no session — signing out');
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setPermittedModules(new Set());
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT' || !nextSession) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setPermittedModules(new Set());
          setLoading(false);
          return;
        }

        // Valid session — set immediately so the UI can render
        setSession(nextSession);
        setUser(nextSession.user);

        if (nextSession.user) {
          // Defer to avoid blocking the auth callback
          setTimeout(() => {
            void fetchUserProfile(nextSession.user.id);
            void fetchPermittedModules();
          }, 0);
        } else {
          setLoading(false);
        }
      },
    );

    // Trigger initial session resolution. The listener above handles the
    // resulting INITIAL_SESSION / SIGNED_IN event.
    void supabase.auth.getSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, fetchPermittedModules]);

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    loading,
    isAdmin,
    permittedModules,
    canAccessModule,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
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
