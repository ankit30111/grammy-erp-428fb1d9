
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";

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
  
  // Get user permissions based on their department
  const { data: userPermissions, isLoading } = useUserPermissions(userId);
  
  // Type guard to ensure userPermissions has the correct structure
  const allowedTabs = userPermissions && typeof userPermissions === 'object' && 'allowedTabs' in userPermissions 
    ? userPermissions.allowedTabs 
    : [];
  
  return {
    userId,
    userPermissions,
    allowedTabs,
    isLoading
  };
};
