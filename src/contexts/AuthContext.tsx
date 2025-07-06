import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserAccount {
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
  userAccount: UserAccount | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserAccount = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select(`
          id,
          email,
          full_name,
          role,
          is_active,
          department_id,
          departments (
            name
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user account:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user account:', error);
      return null;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuthStateChange = async (event: string, session: Session | null) => {
      if (!mounted) return;

      console.log(`Auth state change: ${event}`, session?.user?.id || 'no user');
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, clearing session');
        setSession(null);
        setUser(null);
        setUserAccount(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
        setUser(null);
        setUserAccount(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session.user);

      // Fetch user account details
      const account = await fetchUserAccount(session.user.id);
      setUserAccount(account);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          if (error.message.includes('refresh_token_not_found') || 
              error.message.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
          }
          setSession(null);
          setUser(null);
          setUserAccount(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            const account = await fetchUserAccount(session.user.id);
            setUserAccount(account);
          }
        }
      } catch (error) {
        console.error('Unexpected session error:', error);
        setSession(null);
        setUser(null);
        setUserAccount(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, userAccount, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}