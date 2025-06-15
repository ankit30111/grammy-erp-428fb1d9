
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, User, Search, Filter } from "lucide-react";
import { useState } from "react";

interface ProjectData {
  id: string;
  project_name: string;
  type: 'NPD' | 'Pre-Existing';
  status: string;
  priority: string;
  customer: string;
  created_at: string;
  estimated_completion_date: string;
  daysRemaining: number;
  progressPercentage: number;
}

const ProjectStatusGrid = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: ['project-status-data'],
    queryFn: async () => {
      console.log('Fetching project status data...');
      
      const [npdData, preExistingData] = await Promise.all([
        supabase
          .from('npd_projects')
          .select(`
            *,
            customers (name)
          `),
        supabase
          .from('pre_existing_projects')
          .select(`
            *,
            customers (name)
          `)
      ]);

      if (npdData.error) throw npdData.error;
      if (preExistingData.error) throw preExistingData.error;

      const processedData: ProjectData[] = [];

      // Helper function to calculate days remaining
      const calculateDaysRemaining = (endDate: string): number => {
        if (!endDate) return 0;
        const end = new Date(endDate);
        const now = new Date();
        const timeDiff = end.getTime() - now.getTime();
        const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
      };

      // Helper function to calculate progress percentage
      const calculateProgress = (startDate: string, endDate: string): number => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();
        
        if (now < start) return 0;
        if (now > end) return 100;
        
        const total = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        return Math.round((elapsed / total) * 100);
      };

      // Process NPD projects
      npdData.data?.forEach(project => {
        const daysRemaining = calculateDaysRemaining(project.estimated_completion_date);
        const progressPercentage = calculateProgress(project.created_at, project.estimated_completion_date);
        
        processedData.push({
          id: project.id,
          project_name: project.project_name,
          type: 'NPD',
          status: project.status,
          priority: project.priority,
          customer: project.customers?.name || 'N/A',
          created_at: project.created_at,
          estimated_completion_date: project.estimated_completion_date,
          daysRemaining,
          progressPercentage
        });
      });

      // Process Pre-Existing projects
      preExistingData.data?.forEach(project => {
        const daysRemaining = calculateDaysRemaining(project.estimated_completion_date);
        const progressPercentage = calculateProgress(project.created_at, project.estimated_completion_date);
        
        processedData.push({
          id: project.id,
          project_name: project.project_name,
          type: 'Pre-Existing',
          status: project.status.replace('_', ' '),
          priority: project.priority,
          customer: project.customers?.name || 'N/A',
          created_at: project.created_at,
          estimated_completion_date: project.estimated_completion_date,
          daysRemaining,
          progressPercentage
        });
      });

      return processedData.sort((a, b) => a.project_name.localeCompare(b.project_name));
    }
  });

  // Filter projects based on search and filters
  const filteredProjects = projectsData?.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
    const matchesPriority = priorityFilter === "ALL" || project.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  const getStatusColor = (status: string, type: string) => {
    if (type === 'NPD') {
      switch (status) {
        case 'CONCEPT': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'PROTOTYPE': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'TESTING': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    } else {
      switch (status) {
        case 'CUSTOMIZATION': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'CUSTOMER APPROVAL': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'FINALIZED': return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUrgencyIndicator = (daysRemaining: number) => {
    if (daysRemaining <= 7) return 'text-red-600 font-semibold';
    if (daysRemaining <= 30) return 'text-orange-600 font-medium';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Status Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Status Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">Error loading project data. Please try again.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Project Status Dashboard
        </CardTitle>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="CONCEPT">Concept</SelectItem>
                <SelectItem value="PROTOTYPE">Prototype</SelectItem>
                <SelectItem value="TESTING">Testing</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="CUSTOMIZATION">Customization</SelectItem>
                <SelectItem value="CUSTOMER APPROVAL">Customer Approval</SelectItem>
                <SelectItem value="FINALIZED">Finalized</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priority</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4" />
            <p>No projects match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm leading-tight mb-2">
                        {project.project_name}
                      </h3>
                      <div className="flex gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${project.type === 'NPD' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                        >
                          {project.type}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(project.status, project.type)}`}>
                          {project.status}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(project.priority)}`}>
                      {project.priority}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{project.customer}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Progress</span>
                      <span>{project.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${getProgressColor(project.progressPercentage)}`}
                        style={{ width: `${project.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span className={getUrgencyIndicator(project.daysRemaining)}>
                        {project.daysRemaining} days left
                      </span>
                    </div>
                    {project.estimated_completion_date && (
                      <span className="text-muted-foreground text-xs">
                        Due: {new Date(project.estimated_completion_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectStatusGrid;
