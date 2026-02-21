import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashSpareParts = () => {
  return useQuery({
    queryKey: ["dash-spare-parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_spare_parts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashSpareConsumption = () => {
  return useQuery({
    queryKey: ["dash-spare-consumption"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_spare_consumption")
        .select("*, dash_spare_parts(spare_name, spare_code), dash_service_tickets(ticket_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashSpareMutations = () => {
  const qc = useQueryClient();

  const addSpare = useMutation({
    mutationFn: async (spare: Record<string, unknown>) => {
      const { error } = await supabase.from("dash_spare_parts").insert(spare as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-spare-parts"] });
      toast.success("Spare part added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSpare = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("dash_spare_parts").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-spare-parts"] });
      toast.success("Spare updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const consumeSpare = useMutation({
    mutationFn: async (entry: { spare_id: string; ticket_id?: string; quantity_used: number; consumed_by?: string; notes?: string }) => {
      const { error: cErr } = await supabase.from("dash_spare_consumption").insert(entry as any);
      if (cErr) throw cErr;
      // Reduce stock
      const { data: spare } = await supabase.from("dash_spare_parts").select("stock_quantity").eq("id", entry.spare_id).single();
      if (spare) {
        await supabase.from("dash_spare_parts").update({ stock_quantity: spare.stock_quantity - entry.quantity_used } as any).eq("id", entry.spare_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-spare-parts"] });
      qc.invalidateQueries({ queryKey: ["dash-spare-consumption"] });
      toast.success("Spare consumed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addSpare, updateSpare, consumeSpare };
};
