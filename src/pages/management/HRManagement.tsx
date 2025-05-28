
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, BookOpen, Target, Calendar, DollarSign, BarChart3 } from "lucide-react";
import { EmployeeManagement } from "@/components/HR/EmployeeManagement";
import { SkillMatrix } from "@/components/HR/SkillMatrix";
import { TrainingManagement } from "@/components/HR/TrainingManagement";
import { PayrollManagement } from "@/components/HR/PayrollManagement";
import { PerformanceReviews } from "@/components/HR/PerformanceReviews";
import { HRDashboard } from "@/components/HR/HRDashboard";

const HRManagement = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Human Resources Management</h1>
        </div>
        
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Skills Matrix
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Training
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payroll
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Performance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <HRDashboard />
          </TabsContent>
          
          <TabsContent value="employees" className="mt-6">
            <EmployeeManagement />
          </TabsContent>
          
          <TabsContent value="skills" className="mt-6">
            <SkillMatrix />
          </TabsContent>
          
          <TabsContent value="training" className="mt-6">
            <TrainingManagement />
          </TabsContent>
          
          <TabsContent value="payroll" className="mt-6">
            <PayrollManagement />
          </TabsContent>
          
          <TabsContent value="performance" className="mt-6">
            <PerformanceReviews />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HRManagement;
