import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * What the signed-in user may change, from the database's own rules
 * (my_permissions). The screens use this only to hide buttons; the database
 * enforces the same rules on every write.
 *
 *   Admin        everything, including users
 *   Management   edit masters and customers, approve
 *   R&D          edit parts, BOMs and vendors - held for approval
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_permissions" as any);
      if (error) throw error;
      return data as { edit_masters: boolean; edit_customers: boolean; approve: boolean };
    },
  });
  return {
    canEditMasters: !!data?.edit_masters,
    canEditCustomers: !!data?.edit_customers,
    canApprove: !!data?.approve,
    /** R&D: may edit, but what they save waits for Management. */
    needsApproval: !!data?.edit_masters && !data?.approve,
  };
};
