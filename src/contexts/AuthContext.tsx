import React, { createContext, useContext, useEffect, useState } from 'react';
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingProfile, setFetchingProfile] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  const fetchUserProfile = async (userId: string) => {
    // Prevent multiple simultaneous profile fetches
    if (fetchingProfile) {
      console.log('Profile fetch already in progress, skipping...');
      return;
    }

    setFetchingProfile(true);
    console.log('Fetching user profile for:', userId);
    
    // Add safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Profile fetch timed out after 10 seconds');
      setFetchingProfile(false);
      setLoading(false);
    }, 10000);

    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } else if (data) {
        console.log('User profile found:', data);
        setUserProfile(data);
      } else {
        console.warn('No user profile found for user:', userId);
        setUserProfile(null);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      setFetchingProfile(false);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener - this will handle all auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log(`Auth state change: ${event}`);
        
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        // Valid session - set session and user immediately
        setSession(session);
        setUser(session.user);
        
        // Fetch user profile data asynchronously
        if (session.user) {
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setLoading(false);
        }
      }
    );

    // Safety timeout: if auth doesn't resolve in 5s, force show login
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out after 5s, clearing stale data');
        try {
          localStorage.removeItem('supabase.auth.token');
        } catch (_) { /* ignore */ }
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // onAuthStateChange handler processes the session
    }).catch((error) => {
      console.error('getSession failed:', error);
      if (mounted) {
        try {
          localStorage.removeItem('supabase.auth.token');
        } catch (_) { /* ignore */ }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    userProfile,
    loading,
    isAdmin,
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