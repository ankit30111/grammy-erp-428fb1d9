
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useSidebarAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    
    getCurrentUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Universal access - no permission restrictions
  const userPermissions = null;
  const allowedTabs: string[] = [];
  const isLoading = false;
  
  return {
    userId,
    userPermissions,
    allowedTabs,
    isLoading
  };
};
