
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, GraduationCap, DollarSign, TrendingUp, FileText } from "lucide-react";
import { EmployeeRegistration } from "./EmployeeRegistration";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { TrainingSkillMatrix } from "./TrainingSkillMatrix";
import { PayrollManagement } from "./PayrollManagement";
import { PerformanceReview } from "./PerformanceReview";
import { HRDashboard } from "./HRDashboard";

export function HRManagementPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Human Resources Management</h1>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="registration" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            New Hire
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Directory
          </TabsTrigger>
          <TabsTrigger value="training" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Training & Skills
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          <HRDashboard />
        </TabsContent>
        
        <TabsContent value="registration" className="mt-6">
          <EmployeeRegistration />
        </TabsContent>
        
        <TabsContent value="directory" className="mt-6">
          <EmployeeDirectory />
        </TabsContent>
        
        <TabsContent value="training" className="mt-6">
          <TrainingSkillMatrix />
        </TabsContent>
        
        <TabsContent value="payroll" className="mt-6">
          <PayrollManagement />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-6">
          <PerformanceReview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
