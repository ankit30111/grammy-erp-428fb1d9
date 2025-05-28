
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDepartments = () => {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
};

export const useDepartmentPermissions = (departmentId?: string) => {
  return useQuery({
    queryKey: ["department-permissions", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const { data, error } = await supabase
        .from("department_permissions")
        .select("tab_name")
        .eq("department_id", departmentId);
      
      if (error) throw error;
      return data?.map(item => item.tab_name) || [];
    },
    enabled: !!departmentId,
  });
};
