import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashServiceTickets = () => {
  return useQuery({
    queryKey: ["dash-service-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_service_tickets")
        .select("*, dash_products(product_name, model_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashServiceHistory = (ticketId?: string) => {
  return useQuery({
    queryKey: ["dash-service-history", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_service_history")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });
};

export const useDashServiceMutations = () => {
  const qc = useQueryClient();

  const createTicket = useMutation({
    mutationFn: async (ticket: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_service_tickets")
        .insert({ ...ticket, ticket_number: "" } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-service-tickets"] });
      toast.success("Service ticket created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("dash_service_tickets").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-service-tickets"] });
      toast.success("Ticket updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addHistory = useMutation({
    mutationFn: async (entry: Record<string, unknown>) => {
      const { error } = await supabase.from("dash_service_history").insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-service-history"] });
    },
  });

  return { createTicket, updateTicket, addHistory };
};
