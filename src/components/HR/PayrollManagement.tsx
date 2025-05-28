
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Calculator, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export function PayrollManagement() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState("2024-01");

  const payrollData = [
    {
      employeeId: "EMP001",
      name: "John Smith",
      basicSalary: 45000,
      attendance: 22,
      overtime: 8,
      allowances: 5000,
      deductions: 2000,
      netSalary: 48000,
      status: "Processed"
    },
    {
      employeeId: "EMP002",
      name: "Sarah Wilson",
      basicSalary: 38000,
      attendance: 20,
      overtime: 4,
      allowances: 3000,
      deductions: 1500,
      netSalary: 39500,
      status: "Pending"
    }
  ];

  const handleAttendanceImport = () => {
    toast({
      title: "Attendance Data Imported",
      description: "Attendance data has been successfully imported from the physical machine.",
    });
  };

  const handleSalaryCalculation = () => {
    toast({
      title: "Salaries Calculated",
      description: "All employee salaries have been calculated for the selected month.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Payroll Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Month</p>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button onClick={handleAttendanceImport} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Import Attendance
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button onClick={handleSalaryCalculation} className="w-full" variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Salaries
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Payroll
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">80</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹45.2L</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">65</div>
            <p className="text-xs text-muted-foreground">Salaries processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">Pending approvals</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Payroll Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((employee) => (
                <TableRow key={employee.employeeId}>
                  <TableCell className="font-medium">{employee.employeeId}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>₹{employee.basicSalary.toLocaleString()}</TableCell>
                  <TableCell>{employee.attendance} days</TableCell>
                  <TableCell>{employee.overtime} hrs</TableCell>
                  <TableCell>₹{employee.allowances.toLocaleString()}</TableCell>
                  <TableCell>₹{employee.deductions.toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">₹{employee.netSalary.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === "Processed" ? "default" : "secondary"}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
