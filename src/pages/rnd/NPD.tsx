
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, Plus, Calendar, Users, TrendingUp, Target, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BenchmarkDialog from "@/components/RnD/BenchmarkDialog";
import ProjectBOMDialog from "@/components/RnD/ProjectBOMDialog";

interface NPDProject {
  id: string;
  project_name: string;
  customer_id: string;
  requirements: string;
  status: string;
  priority: string;
  estimated_completion_date: string;
  project_description: string;
  created_at: string;
  customers: { name: string };
}

interface NewNPDProject {
  project_name: string;
  customer_id: string;
  requirements: string;
  project_description: string;
  priority: string;
  estimated_completion_date: string;
}

const NPD = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState<NewNPDProject>({
    project_name: '',
    customer_id: '',
    requirements: '',
    project_description: '',
    priority: 'MEDIUM',
    estimated_completion_date: ''
  });
  const [selectedProjectForBenchmark, setSelectedProjectForBenchmark] = useState<string | null>(null);
  const [selectedProjectForBOM, setSelectedProjectForBOM] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch NPD projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['npd-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_projects')
        .select(`
          *,
          customers (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as NPDProject[];
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

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (project: NewNPDProject) => {
      const { data, error } = await supabase
        .from('npd_projects')
        .insert([project])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['npd-projects'] });
      setIsCreateOpen(false);
      setNewProject({
        project_name: '',
        customer_id: '',
        requirements: '',
        project_description: '',
        priority: 'MEDIUM',
        estimated_completion_date: ''
      });
      
      // Auto-open benchmark dialog after project creation
      setSelectedProjectForBenchmark(data.id);
      setSelectedProjectName(data.project_name);
      
      toast({
        title: "Success",
        description: "NPD project created successfully. Now set up benchmarks."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create NPD project",
        variant: "destructive"
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONCEPT': return 'bg-yellow-100 text-yellow-800';
      case 'PROTOTYPE': return 'bg-blue-100 text-blue-800';
      case 'TESTING': return 'bg-purple-100 text-purple-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-orange-100 text-orange-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateProject = () => {
    if (!newProject.project_name || !newProject.customer_id) {
      toast({
        title: "Error",
        description: "Project name and customer are required",
        variant: "destructive"
      });
      return;
    }
    createProjectMutation.mutate(newProject);
  };

  const handleBenchmarkCreated = () => {
    setSelectedProjectForBenchmark(null);
    // Auto-open BOM dialog after benchmark creation
    if (selectedProjectForBenchmark) {
      setSelectedProjectForBOM(selectedProjectForBenchmark);
    }
  };

  return (
    <DashboardLayout>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">NPD (New Product Development)</h1>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New NPD Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New NPD Project</DialogTitle>
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
                  <Label htmlFor="project_description">Project Description</Label>
                  <Textarea
                    id="project_description"
                    value={newProject.project_description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, project_description: e.target.value }))}
                    placeholder="Describe the project objectives and scope"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Customer Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={newProject.requirements}
                    onChange={(e) => setNewProject(prev => ({ ...prev, requirements: e.target.value }))}
                    placeholder="Detail customer requirements and specifications"
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
              <TrendingUp className="h-5 w-5" />
              NPD Project Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading projects...</div>
            ) : projects?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4" />
                <p>No NPD projects yet. Create your first project to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Estimated Completion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects?.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>{project.customers?.name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(project.priority)}>
                          {project.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {project.estimated_completion_date ? 
                          new Date(project.estimated_completion_date).toLocaleDateString() : 
                          'Not set'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProjectForBenchmark(project.id);
                              setSelectedProjectName(project.project_name);
                            }}
                          >
                            <Target className="h-4 w-4 mr-1" />
                            Benchmarks
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProjectForBOM(project.id);
                              setSelectedProjectName(project.project_name);
                            }}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            BOM
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Benchmark Dialog */}
        <BenchmarkDialog
          isOpen={!!selectedProjectForBenchmark}
          onClose={() => setSelectedProjectForBenchmark(null)}
          projectId={selectedProjectForBenchmark || ''}
          projectName={selectedProjectName}
          onBenchmarkCreated={handleBenchmarkCreated}
        />

        {/* Project BOM Dialog */}
        <ProjectBOMDialog
          isOpen={!!selectedProjectForBOM}
          onClose={() => setSelectedProjectForBOM(null)}
          projectId={selectedProjectForBOM || ''}
          projectName={selectedProjectName}
        />
      </div>
    </DashboardLayout>
  );
};

export default NPD;
