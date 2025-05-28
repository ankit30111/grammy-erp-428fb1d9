
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface UserPermission {
  module: string;
}

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  permissions: string[];
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (module: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);

        const { data: permissionsData } = await supabase
          .from('user_permissions')
          .select('module')
          .eq('user_id', userId);

        if (permissionsData) {
          setPermissions(permissionsData.map((p: UserPermission) => p.module));
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setPermissions([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      // First, find the user by username to get their email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (profileError || !profileData) {
        return { error: { message: 'Invalid username or password' } };
      }

      // Get the user's email from auth.users using the admin API
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find((u: AuthUser) => u.id === profileData.id);
      
      if (!authUser?.email) {
        return { error: { message: 'Invalid username or password' } };
      }

      // Sign in with email and password
      const { error } = await supabase.auth.signInWithPassword({ 
        email: authUser.email, 
        password 
      });
      
      return { error };
    } catch (error: any) {
      return { error: { message: 'Invalid username or password' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (module: string) => {
    return profile?.role === 'admin' || permissions.includes(module);
  };

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  const value = {
    user,
    profile,
    permissions,
    session,
    loading,
    signIn,
    signOut,
    hasPermission,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
