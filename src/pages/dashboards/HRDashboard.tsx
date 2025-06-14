
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, BookOpen, TrendingUp, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const HRDashboard = () => {
  const navigate = useNavigate();

  const { data: hrData, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const [employeesData, attendanceData, trainingData] = await Promise.all([
        supabase.from('employees').select(`
          id,
          first_name,
          last_name,
          employee_code,
          position,
          department,
          state,
          status
        `).eq('status', 'active'),
        supabase.from('attendance').select('*').gte('date', new Date().toISOString().split('T')[0]),
        supabase.from('employee_training').select('*')
      ]);

      const totalEmployees = employeesData.data?.length || 0;
      const presentToday = attendanceData.data?.filter(a => a.status === 'present').length || 0;
      const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

      const completedTraining = trainingData.data?.filter(t => t.status === 'completed').length || 0;
      const totalTraining = trainingData.data?.length || 0;
      const trainingCompletion = totalTraining > 0 ? Math.round((completedTraining / totalTraining) * 100) : 0;

      return {
        totalEmployees,
        attendanceRate,
        trainingCompletion,
        employees: employeesData.data?.slice(0, 5) || []
      };
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Human Resources Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/management/hr')} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              HR Management
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Total Employees"
            value={hrData?.totalEmployees || 0}
            icon={Users}
            isLoading={isLoading}
            subtitle="Active employees"
          />
          <KPICard
            title="Attendance Rate"
            value={`${hrData?.attendanceRate || 0}%`}
            icon={Calendar}
            isLoading={isLoading}
            subtitle="Present today"
          />
          <KPICard
            title="Training Completion"
            value={`${hrData?.trainingCompletion || 0}%`}
            icon={BookOpen}
            isLoading={isLoading}
            subtitle="Completed programs"
          />
          <KPICard
            title="Performance Reviews"
            value="95%"
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Completed this quarter"
          />
        </div>

        {/* Employee Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Himachal Resident</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hrData?.employees?.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.employee_code}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      {employee.state === 'Himachal Pradesh' ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>HR Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button 
                onClick={() => navigate('/management/hr')} 
                className="justify-start"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-2" />
                Employee Management
              </Button>
              <Button 
                onClick={() => navigate('/management/hr')} 
                className="justify-start"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Attendance Tracking
              </Button>
              <Button 
                onClick={() => navigate('/management/hr')} 
                className="justify-start"
                variant="outline"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Training Programs
              </Button>
              <Button 
                onClick={() => navigate('/management/hr')} 
                className="justify-start"
                variant="outline"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Performance Reviews
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HRDashboard;
