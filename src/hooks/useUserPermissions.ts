
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserPermissions = (userId?: string) => {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_accounts")
        .select(`
          department_id,
          departments!department_id (
            name,
            department_permissions!department_id (
              tab_name
            )
          )
        `)
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      
      const permissions = data?.departments?.department_permissions?.map(p => p.tab_name) || [];
      return {
        departmentName: data?.departments?.name,
        allowedTabs: permissions
      };
    },
    enabled: !!userId,
  });
};
