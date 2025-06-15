
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

      // Helper function to safely parse dates with better validation
      const parseDate = (dateString: string): Date => {
        if (!dateString || typeof dateString !== 'string') {
          return new Date();
        }
        
        const parsed = new Date(dateString);
        if (isNaN(parsed.getTime())) {
          console.warn('Invalid date string:', dateString);
          return new Date();
        }
        
        return parsed;
      };

      // Helper function to safely calculate progress with comprehensive validation
      const calculateProgress = (startDate: Date, endDate: Date): number => {
        const now = new Date();
        
        // Validate all dates are valid
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(now.getTime())) {
          console.warn('Invalid date encountered in progress calculation');
          return 0;
        }
        
        // Ensure end date is after start date
        if (endDate <= startDate) {
          console.warn('End date is before or equal to start date');
          return 0;
        }
        
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        
        // Validate calculations
        if (totalDuration <= 0) {
          return 0;
        }
        
        const progressRatio = elapsed / totalDuration;
        const progress = Math.max(0, Math.min(100, progressRatio * 100));
        
        // Final validation to ensure we never return NaN
        if (!Number.isFinite(progress) || Number.isNaN(progress)) {
          console.warn('Progress calculation resulted in invalid number, returning 0');
          return 0;
        }
        
        return Math.round(progress * 10) / 10; // Round to 1 decimal place
      };

      // Helper function to safely calculate days remaining
      const calculateDaysRemaining = (endDate: Date): number => {
        const now = new Date();
        
        if (isNaN(endDate.getTime()) || isNaN(now.getTime())) {
          console.warn('Invalid date in days remaining calculation');
          return 0;
        }
        
        const timeDiff = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        const result = Math.max(0, daysRemaining);
        
        // Ensure we never return NaN
        if (!Number.isFinite(result) || Number.isNaN(result)) {
          console.warn('Days remaining calculation resulted in invalid number, returning 0');
          return 0;
        }
        
        return result;
      };

      // Helper function to validate complete project data
      const isValidProject = (projectData: any): boolean => {
        return (
          projectData &&
          projectData.project_name && 
          typeof projectData.project_name === 'string' &&
          projectData.project_name.trim() !== ''
        );
      };

      // Process NPD projects with enhanced validation
      npdData.data?.forEach(project => {
        if (!isValidProject(project)) {
          console.warn('Skipping invalid NPD project:', project);
          return;
        }

        try {
          const startDate = parseDate(project.created_at);
          let endDate = parseDate(project.estimated_completion_date);
          
          // If no completion date or invalid, set to 90 days from start
          if (!project.estimated_completion_date || isNaN(endDate.getTime())) {
            endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
          }
          
          // Ensure end date is after start date
          if (endDate <= startDate) {
            endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
          }

          const progress = calculateProgress(startDate, endDate);
          const daysRemaining = calculateDaysRemaining(endDate);

          // Validate final values before adding to data
          if (!Number.isFinite(progress) || Number.isNaN(progress) ||
              !Number.isFinite(daysRemaining) || Number.isNaN(daysRemaining)) {
            console.warn('Skipping NPD project due to invalid calculations:', project.project_name);
            return;
          }

          let color = '#3b82f6'; // blue
          if (project.status === 'CONCEPT') color = '#f59e0b'; // amber
          else if (project.status === 'PROTOTYPE') color = '#8b5cf6'; // purple
          else if (project.status === 'TESTING') color = '#06b6d4'; // cyan

          processedData.push({
            projectName: project.project_name,
            type: 'NPD',
            status: project.status,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            progress: progress,
            customer: project.customers?.name || 'N/A',
            daysRemaining: daysRemaining,
            color
          });

          console.log('Added NPD project:', project.project_name, 'Progress:', progress, 'Days remaining:', daysRemaining);
        } catch (error) {
          console.error('Error processing NPD project:', project.project_name, error);
        }
      });

      // Process Pre-Existing projects with enhanced validation
      preExistingData.data?.forEach(project => {
        if (!isValidProject(project)) {
          console.warn('Skipping invalid pre-existing project:', project);
          return;
        }

        try {
          const startDate = parseDate(project.created_at);
          let endDate = parseDate(project.estimated_completion_date);
          
          // If no completion date or invalid, set to 60 days from start
          if (!project.estimated_completion_date || isNaN(endDate.getTime())) {
            endDate = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
          }
          
          // Ensure end date is after start date
          if (endDate <= startDate) {
            endDate = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
          }

          const progress = calculateProgress(startDate, endDate);
          const daysRemaining = calculateDaysRemaining(endDate);

          // Validate final values before adding to data
          if (!Number.isFinite(progress) || Number.isNaN(progress) ||
              !Number.isFinite(daysRemaining) || Number.isNaN(daysRemaining)) {
            console.warn('Skipping pre-existing project due to invalid calculations:', project.project_name);
            return;
          }

          let color = '#10b981'; // green
          if (project.status === 'CUSTOMIZATION') color = '#f59e0b'; // amber
          else if (project.status === 'CUSTOMER_APPROVAL') color = '#8b5cf6'; // purple

          processedData.push({
            projectName: project.project_name,
            type: 'Pre-Existing',
            status: project.status.replace('_', ' '),
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            progress: progress,
            customer: project.customers?.name || 'N/A',
            daysRemaining: daysRemaining,
            color
          });

          console.log('Added pre-existing project:', project.project_name, 'Progress:', progress, 'Days remaining:', daysRemaining);
        } catch (error) {
          console.error('Error processing pre-existing project:', project.project_name, error);
        }
      });

      console.log('Final processed data:', processedData);
      
      return processedData.sort((a, b) => a.projectName.localeCompare(b.projectName));
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
                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
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
