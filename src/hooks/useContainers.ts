import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Container {
  id: string;
  container_number: string;
  current_status: string;
  ordered_date?: string;
  loading_date?: string;
  loaded_date?: string;
  china_custom_date?: string;
  shipped_date?: string;
  in_transit_date?: string;
  indian_dock_date?: string;
  in_train_date?: string;
  india_custom_date?: string;
  dispatched_date?: string;
  arrived_date?: string;
  supplier_info?: string;
  vessel_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ContainerMaterial {
  id: string;
  container_id: string;
  brand?: string;
  model: string;
  material_description: string;
  quantity: number;
  status: 'COMPLETE' | 'PARTIAL';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useContainers = () => {
  return useQuery({
    queryKey: ["containers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_containers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Container[];
    }
  });
};

export const useContainer = (id: string) => {
  return useQuery({
    queryKey: ["container", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_containers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Container;
    },
    enabled: !!id
  });
};

export const useContainerMaterials = (containerId: string) => {
  return useQuery({
    queryKey: ["container-materials", containerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("container_materials")
        .select("*")
        .eq("container_id", containerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContainerMaterial[];
    },
    enabled: !!containerId
  });
};

export const useCreateContainer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (container: Omit<Container, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("import_containers")
        .insert([container])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast({
        title: "Success",
        description: "Container created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create container",
        variant: "destructive"
      });
    }
  });
};

export const useUpdateContainer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Container> & { id: string }) => {
      const { data, error } = await supabase
        .from("import_containers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["container", data.id] });
      toast({
        title: "Success",
        description: "Container updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update container",
        variant: "destructive"
      });
    }
  });
};

export const useCreateContainerMaterial = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (material: Omit<ContainerMaterial, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("container_materials")
        .insert([material])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["container-materials", data.container_id] });
      toast({
        title: "Success",
        description: "Material added successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add material",
        variant: "destructive"
      });
    }
  });
};

export const useUpdateContainerMaterial = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContainerMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from("container_materials")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["container-materials", data.container_id] });
      toast({
        title: "Success",
        description: "Material updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update material",
        variant: "destructive"
      });
    }
  });
};

export const useDeleteContainerMaterial = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("container_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["container-materials"] });
      toast({
        title: "Success",
        description: "Material deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete material",
        variant: "destructive"
      });
    }
  });
};