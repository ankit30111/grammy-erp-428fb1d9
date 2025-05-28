
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, DollarSign, FileText } from "lucide-react";

export function PayrollManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['payroll-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll')
        .select(`
          *,
          employees:employee_id (first_name, last_name, employee_code, salary)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          employee_id,
          date,
          status,
          overtime_hours,
          employees:employee_id (first_name, last_name, employee_code)
        `)
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
      
      if (error) throw error;
      return data;
    }
  });

  const importAttendanceMutation = useMutation({
    mutationFn: async (file: File) => {
      // Simulate attendance import from CSV/Excel file
      // In a real application, you would parse the file and insert data
      const text = await file.text();
      const lines = text.split('\n').slice(1); // Skip header
      
      const attendanceData = lines.map(line => {
        const [employeeCode, date, checkIn, checkOut] = line.split(',');
        return {
          // This would need to be mapped to actual employee IDs
          employee_id: 'placeholder-id',
          date,
          check_in_time: checkIn,
          check_out_time: checkOut,
          imported_from_machine: true,
        };
      });

      // For demo purposes, just show success
      return attendanceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast({ title: "Attendance data imported successfully" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error importing attendance", description: error.message, variant: "destructive" });
    }
  });

  const generatePayrollMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // This would calculate payroll based on attendance data
      // For demo purposes, we'll create sample payroll entries
      
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, salary')
        .eq('status', 'active');

      if (empError) throw empError;

      const payrollEntries = employees?.map(emp => ({
        employee_id: emp.id,
        month,
        year,
        basic_salary: emp.salary || 0,
        allowances: (emp.salary || 0) * 0.1, // 10% allowances
        gross_salary: (emp.salary || 0) * 1.1,
        net_salary: (emp.salary || 0) * 1.1,
        total_working_days: 22,
        present_days: 20, // This would be calculated from attendance
        status: 'draft'
      }));

      const { error } = await supabase
        .from('payroll')
        .insert(payrollEntries);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-data'] });
      toast({ title: "Payroll generated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error generating payroll", description: error.message, variant: "destructive" });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttendanceFile(file);
    }
  };

  const handleImportAttendance = () => {
    if (attendanceFile) {
      importAttendanceMutation.mutate(attendanceFile);
    }
  };

  const handleGeneratePayroll = () => {
    if (!selectedMonth || !selectedYear) {
      toast({ title: "Please select month and year", variant: "destructive" });
      return;
    }
    generatePayrollMutation.mutate({ 
      month: parseInt(selectedMonth), 
      year: parseInt(selectedYear) 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'draft': return 'bg-yellow-500';
      case 'paid': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Payroll Management</h2>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import Attendance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Attendance Data</DialogTitle>
                <DialogDescription>
                  Upload attendance data from your physical attendance machine.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="attendance-file">Upload CSV/Excel File</Label>
                  <Input
                    id="attendance-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Expected format: Employee Code, Date, Check In, Check Out
                  </p>
                </div>

                {attendanceFile && (
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm">
                      Selected file: {attendanceFile.name}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleImportAttendance}
                  disabled={!attendanceFile || importAttendanceMutation.isPending}
                >
                  Import Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <DollarSign className="h-4 w-4 mr-2" />
                Generate Payroll
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Monthly Payroll</DialogTitle>
                <DialogDescription>
                  Select the month and year to generate payroll for all employees.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="month">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="year">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleGeneratePayroll}
                  disabled={generatePayrollMutation.isPending}
                >
                  Generate Payroll
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This Month's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Employees:</span>
                <span className="font-semibold">
                  {new Set(attendance?.map(a => a.employee_id)).size || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Present Today:</span>
                <span className="font-semibold">
                  {attendance?.filter(a => 
                    a.date === new Date().toISOString().split('T')[0] && 
                    a.status === 'present'
                  ).length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Overtime Hours:</span>
                <span className="font-semibold">
                  {attendance?.reduce((sum, a) => sum + (a.overtime_hours || 0), 0).toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payroll Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Draft:</span>
                <span className="font-semibold">
                  {payrollData?.filter(p => p.status === 'draft').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Approved:</span>
                <span className="font-semibold">
                  {payrollData?.filter(p => p.status === 'approved').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid:</span>
                <span className="font-semibold">
                  {payrollData?.filter(p => p.status === 'paid').length || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{payrollData?.reduce((sum, p) => sum + (p.net_salary || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-sm text-gray-500">Current month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Records</CardTitle>
          <CardDescription>Monthly payroll history and status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading payroll data...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month/Year</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData?.slice(0, 20).map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell>
                      {payroll.employees?.employee_code} - {payroll.employees?.first_name} {payroll.employees?.last_name}
                    </TableCell>
                    <TableCell>
                      {payroll.month}/{payroll.year}
                    </TableCell>
                    <TableCell>₹{payroll.basic_salary?.toLocaleString()}</TableCell>
                    <TableCell>₹{payroll.gross_salary?.toLocaleString()}</TableCell>
                    <TableCell>₹{payroll.net_salary?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payroll.status || 'draft')}>
                        {payroll.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
