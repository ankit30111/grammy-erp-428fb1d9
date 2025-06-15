
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Clock } from "lucide-react";

interface GanttData {
  projectName: string;
  type: 'NPD' | 'Pre-Existing';
  status: string;
  startDate: string;
  endDate: string;
  progress: number;
  customer: string;
  daysRemaining: number;
  color: string;
}

const ProjectGanttChart = () => {
  const { data: ganttData, isLoading, error } = useQuery({
    queryKey: ['project-gantt-data'],
    queryFn: async () => {
      console.log('Fetching project gantt data...');
      
      const [npdData, preExistingData] = await Promise.all([
        supabase
          .from('npd_projects')
          .select(`
            *,
            customers (name)
          `)
          .neq('status', 'APPROVED'),
        supabase
          .from('pre_existing_projects')
          .select(`
            *,
            customers (name)
          `)
          .neq('status', 'FINALIZED')
      ]);

      if (npdData.error) throw npdData.error;
      if (preExistingData.error) throw preExistingData.error;

      console.log('NPD Data:', npdData.data);
      console.log('Pre-existing Data:', preExistingData.data);

      const processedData: GanttData[] = [];

      // Helper function to safely parse and validate dates
      const parseAndValidateDate = (dateString: string, fallbackDays: number = 90): Date => {
        if (!dateString) {
          return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
        }
        
        const parsed = new Date(dateString);
        if (isNaN(parsed.getTime())) {
          console.warn('Invalid date string:', dateString, 'using fallback');
          return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
        }
        
        return parsed;
      };

      // Helper function to safely calculate progress with proper validation
      const calculateProgress = (startDate: Date, endDate: Date): number => {
        const now = new Date();
        
        // Ensure end date is after start date, if not, set a reasonable end date
        if (endDate <= startDate) {
          console.warn('End date is before or equal to start date, adjusting end date');
          endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from start
        }
        
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (totalDays <= 0) {
          return 0;
        }
        
        const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
        
        // Final validation
        if (!isFinite(progress) || isNaN(progress)) {
          console.warn('Invalid progress calculated, defaulting to 0');
          return 0;
        }
        
        return Math.round(progress * 10) / 10; // Round to 1 decimal place
      };

      // Helper function to safely calculate days remaining
      const calculateDaysRemaining = (endDate: Date): number => {
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (!isFinite(daysRemaining) || isNaN(daysRemaining)) {
          console.warn('Invalid days remaining calculated, defaulting to 0');
          return 0;
        }
        
        return daysRemaining;
      };

      // Helper function to validate complete project data
      const isValidProject = (projectData: any): boolean => {
        return (
          projectData?.project_name && 
          typeof projectData.project_name === 'string' &&
          projectData.project_name.trim() !== '' &&
          projectData.created_at
        );
      };

      // Process NPD projects
      npdData.data?.forEach(project => {
        if (!isValidProject(project)) {
          console.warn('Skipping invalid NPD project:', project);
          return;
        }

        try {
          const startDate = parseAndValidateDate(project.created_at);
          const endDate = parseAndValidateDate(
            project.estimated_completion_date, 
            90 // 90 days fallback
          );

          // Ensure dates are valid and logical
          const adjustedEndDate = endDate <= startDate ? 
            new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000) : 
            endDate;

          const progress = calculateProgress(startDate, adjustedEndDate);
          const daysRemaining = calculateDaysRemaining(adjustedEndDate);

          let color = '#3b82f6'; // blue
          if (project.status === 'CONCEPT') color = '#f59e0b'; // amber
          else if (project.status === 'PROTOTYPE') color = '#8b5cf6'; // purple
          else if (project.status === 'TESTING') color = '#06b6d4'; // cyan

          const projectItem: GanttData = {
            projectName: project.project_name,
            type: 'NPD',
            status: project.status,
            startDate: startDate.toISOString().split('T')[0],
            endDate: adjustedEndDate.toISOString().split('T')[0],
            progress,
            customer: project.customers?.name || 'N/A',
            daysRemaining,
            color
          };

          // Final validation before adding
          if (isFinite(projectItem.progress) && isFinite(projectItem.daysRemaining)) {
            processedData.push(projectItem);
            console.log('Added NPD project:', projectItem.projectName, 'Progress:', projectItem.progress, 'Days remaining:', projectItem.daysRemaining);
          } else {
            console.warn('Skipping NPD project due to invalid calculations:', projectItem);
          }
        } catch (error) {
          console.error('Error processing NPD project:', project.project_name, error);
        }
      });

      // Process Pre-Existing projects
      preExistingData.data?.forEach(project => {
        if (!isValidProject(project)) {
          console.warn('Skipping invalid pre-existing project:', project);
          return;
        }

        try {
          const startDate = parseAndValidateDate(project.created_at);
          const endDate = parseAndValidateDate(
            project.estimated_completion_date,
            60 // 60 days fallback
          );

          // Ensure dates are valid and logical
          const adjustedEndDate = endDate <= startDate ? 
            new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000) : 
            endDate;

          const progress = calculateProgress(startDate, adjustedEndDate);
          const daysRemaining = calculateDaysRemaining(adjustedEndDate);

          let color = '#10b981'; // green
          if (project.status === 'CUSTOMIZATION') color = '#f59e0b'; // amber
          else if (project.status === 'CUSTOMER_APPROVAL') color = '#8b5cf6'; // purple

          const projectItem: GanttData = {
            projectName: project.project_name,
            type: 'Pre-Existing',
            status: project.status.replace('_', ' '),
            startDate: startDate.toISOString().split('T')[0],
            endDate: adjustedEndDate.toISOString().split('T')[0],
            progress,
            customer: project.customers?.name || 'N/A',
            daysRemaining,
            color
          };

          // Final validation before adding
          if (isFinite(projectItem.progress) && isFinite(projectItem.daysRemaining)) {
            processedData.push(projectItem);
            console.log('Added pre-existing project:', projectItem.projectName, 'Progress:', projectItem.progress, 'Days remaining:', projectItem.daysRemaining);
          } else {
            console.warn('Skipping pre-existing project due to invalid calculations:', projectItem);
          }
        } catch (error) {
          console.error('Error processing pre-existing project:', project.project_name, error);
        }
      });

      // Sort and return only valid projects
      const validProjects = processedData.filter(project => {
        const isValid = (
          typeof project.progress === 'number' &&
          typeof project.daysRemaining === 'number' &&
          isFinite(project.progress) &&
          isFinite(project.daysRemaining) &&
          !isNaN(project.progress) &&
          !isNaN(project.daysRemaining) &&
          project.progress >= 0 &&
          project.progress <= 100 &&
          project.projectName &&
          project.projectName.trim() !== ''
        );
        
        if (!isValid) {
          console.error('Filtering out invalid project:', project);
        }
        
        return isValid;
      });

      console.log('Final valid projects count:', validProjects.length);
      console.log('Final processed data:', validProjects);
      
      return validProjects.sort((a, b) => a.projectName.localeCompare(b.projectName));
    }
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.projectName}</p>
          <p className="text-sm text-muted-foreground">{data.type} Project</p>
          <p className="text-sm">Status: {data.status}</p>
          <p className="text-sm">Customer: {data.customer}</p>
          <p className="text-sm">Progress: {data.progress.toFixed(1)}%</p>
          <p className="text-sm">Days Remaining: {data.daysRemaining}</p>
          <p className="text-sm">End Date: {data.endDate}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading project timeline...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error('Error loading gantt data:', error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
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
          Project Timeline & Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!ganttData || ganttData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4" />
            <p>No active projects to display</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {ganttData?.filter(p => p.type === 'NPD').length || 0}
                </div>
                <div className="text-sm text-blue-700">NPD Projects</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {ganttData?.filter(p => p.type === 'Pre-Existing').length || 0}
                </div>
                <div className="text-sm text-green-700">Customization Projects</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {ganttData?.filter(p => p.daysRemaining < 30).length || 0}
                </div>
                <div className="text-sm text-orange-700">Due in 30 Days</div>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={ganttData}
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  type="category" 
                  dataKey="projectName" 
                  width={90}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="progress" radius={4}>
                  {ganttData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectGanttChart;
