
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Clock, Users } from "lucide-react";

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
  const { data: ganttData, isLoading } = useQuery({
    queryKey: ['project-gantt-data'],
    queryFn: async () => {
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

      const processedData: GanttData[] = [];

      // Process NPD projects
      npdData.data?.forEach(project => {
        const startDate = new Date(project.created_at);
        const endDate = project.estimated_completion_date ? new Date(project.estimated_completion_date) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const progress = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100);
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
          progress,
          customer: project.customers?.name || 'N/A',
          daysRemaining,
          color
        });
      });

      // Process Pre-Existing projects
      preExistingData.data?.forEach(project => {
        const startDate = new Date(project.created_at);
        const endDate = project.estimated_completion_date ? new Date(project.estimated_completion_date) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const progress = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100);
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let color = '#10b981'; // green
        if (project.status === 'CUSTOMIZATION') color = '#f59e0b'; // amber
        else if (project.status === 'CUSTOMER_APPROVAL') color = '#8b5cf6'; // purple

        processedData.push({
          projectName: project.project_name,
          type: 'Pre-Existing',
          status: project.status.replace('_', ' '),
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          progress,
          customer: project.customers?.name || 'N/A',
          daysRemaining,
          color
        });
      });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Project Timeline & Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ganttData?.length === 0 ? (
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
