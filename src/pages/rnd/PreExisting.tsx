
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { rndRouteTabs } from "@/components/shell/moduleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Palette, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// pre_existing_projects was folded into npd_projects. Column mapping:
//   base_product_id             -> target_part_id
//   estimated_completion_date   -> target_launch_date
//   status                      -> stage (npd_stage enum)
//   customization_type / _details / brand_requirements -> notes (no columns)
//   priority                    -> no replacement column
interface PreExistingProject {
  id: string;
  project_name: string;
  project_code: string;
  customer_id: string;
  target_part_id: string;
  stage: string;
  target_launch_date: string;
  notes: string;
  created_at: string;
  customers: { name: string };
  parts: { name: string };
}

interface NewPreExistingProject {
  project_name: string;
  customer_id: string;
  base_product_id: string;
  customization_type: string;
  customization_details: string;
  brand_requirements: string;
  priority: string;
  estimated_completion_date: string;
}

const PreExisting = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState<NewPreExistingProject>({
    project_name: '',
    customer_id: '',
    base_product_id: '',
    customization_type: '',
    customization_details: '',
    brand_requirements: '',
    priority: 'MEDIUM',
    estimated_completion_date: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pre-existing projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['pre-existing-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_projects')
        .select(`
          *,
          customers (name),
          parts:target_part_id (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PreExistingProject[];
    }
  });

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('id, name')
        .eq('source_type', 'FINISHED_GOOD')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (project: NewPreExistingProject) => {
      const { data, error } = await supabase
        .from('npd_projects')
        .insert([{
          project_code: `NPD-${Date.now().toString().slice(-6)}`,
          project_name: project.project_name,
          customer_id: project.customer_id,
          target_part_id: project.base_product_id,
          target_launch_date: project.estimated_completion_date || null,
          stage: 'CONCEPT',
          // npd_projects has no customization/brand/priority columns, so those
          // answers are folded into the single notes field.
          notes: [
            project.customization_type && `Customization: ${project.customization_type}`,
            project.priority && `Priority: ${project.priority}`,
            project.brand_requirements && `Brand requirements: ${project.brand_requirements}`,
            project.customization_details && `Details: ${project.customization_details}`
          ].filter(Boolean).join('\n') || null,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-existing-projects'] });
      setIsCreateOpen(false);
      setNewProject({
        project_name: '',
        customer_id: '',
        base_product_id: '',
        customization_type: '',
        customization_details: '',
        brand_requirements: '',
        priority: 'MEDIUM',
        estimated_completion_date: ''
      });
      toast({
        title: "Success",
        description: "Pre-existing product project created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive"
      });
    }
  });

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'CONCEPT': return 'bg-muted text-foreground';
      case 'DESIGN': return 'bg-accent text-primary';
      case 'BOM': return 'bg-accent text-primary';
      case 'SAMPLE': return 'bg-warning-wash text-warning';
      case 'VALIDATION': return 'bg-warning-wash text-warning';
      case 'LAUNCHED': return 'bg-success-wash text-success';
      case 'DROPPED': return 'bg-destructive-wash text-destructive';
      default: return 'bg-muted text-foreground';
    }
  };

  const handleCreateProject = () => {
    if (!newProject.project_name || !newProject.customer_id || !newProject.base_product_id) {
      toast({
        title: "Error",
        description: "Project name, customer, and base product are required",
        variant: "destructive"
      });
      return;
    }
    createProjectMutation.mutate(newProject);
  };

  const customizationTypes = [
    "Packaging & Branding",
    "Software UI/UX",
    "Accessories & Add-ons",
    "Documentation & Manuals",
    "Hardware Modifications",
    "Color & Finish",
    "Complete Rebranding"
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Pre-Existing" />
      <TabBar tabs={rndRouteTabs} />
      <div className="grid gap-6 pt-4">
        <div className="flex items-center justify-end">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>

            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Customization Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Customization Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_name">Project Name *</Label>
                    <Input
                      id="project_name"
                      value={newProject.project_name}
                      onChange={(e) => setNewProject(prev => ({ ...prev, project_name: e.target.value }))}
                      placeholder="Enter project name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <Select 
                      value={newProject.customer_id} 
                      onValueChange={(value) => setNewProject(prev => ({ ...prev, customer_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_product">Base Product *</Label>
                    <Select 
                      value={newProject.base_product_id} 
                      onValueChange={(value) => setNewProject(prev => ({ ...prev, base_product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select base product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customization_type">Customization Type</Label>
                    <Select 
                      value={newProject.customization_type} 
                      onValueChange={(value) => setNewProject(prev => ({ ...prev, customization_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customization type" />
                      </SelectTrigger>
                      <SelectContent>
                        {customizationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select 
                      value={newProject.priority} 
                      onValueChange={(value) => setNewProject(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimated_completion">Estimated Completion</Label>
                    <Input
                      id="estimated_completion"
                      type="date"
                      value={newProject.estimated_completion_date}
                      onChange={(e) => setNewProject(prev => ({ ...prev, estimated_completion_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand_requirements">Brand Requirements</Label>
                  <Textarea
                    id="brand_requirements"
                    value={newProject.brand_requirements}
                    onChange={(e) => setNewProject(prev => ({ ...prev, brand_requirements: e.target.value }))}
                    placeholder="Specify brand guidelines, colors, logos, and branding requirements"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customization_details">Customization Details</Label>
                  <Textarea
                    id="customization_details"
                    value={newProject.customization_details}
                    onChange={(e) => setNewProject(prev => ({ ...prev, customization_details: e.target.value }))}
                    placeholder="Detail specific customization requirements and scope"
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject} disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Product Customization Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading projects...</div>
            ) : projects?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No customization projects yet. Create your first project to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Base Product</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Est. Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects?.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>{project.customers?.name}</TableCell>
                      <TableCell>{project.parts?.name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(project.stage)}>
                          {project.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {project.target_launch_date ?
                          new Date(project.target_launch_date).toLocaleDateString() :
                          'Not set'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PreExisting;
