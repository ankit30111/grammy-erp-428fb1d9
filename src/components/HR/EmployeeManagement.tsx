import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Eye } from "lucide-react";

/** Today in India, as YYYY-MM-DD (leaving dates are compared with it). */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const fmtDate = (iso: string) => iso.split('-').reverse().join('-');

async function loadSensitive(id: string) {
  const { data, error } = await (supabase as any).rpc('get_employee_sensitive', { p_employee_id: id });
  return { ok: !error, sensitive: (Array.isArray(data) ? data[0] : data) ?? {} };
}

/** Everything on file for one employee, read only. */
function EmployeeDetails({ employee: e, onClose, onEdit }: { employee: any; onClose: () => void; onEdit: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-sensitive', e.id],
    queryFn: () => loadSensitive(e.id),
  });
  const s = data?.sensitive ?? {};
  const rows: [string, [string, any][]][] = [
    ['Work', [['Employee code', e.employee_code], ['Position', e.position], ['Department', e.department],
              ['Joining date', e.hire_date && fmtDate(e.hire_date)], ['Leaving date', e.leaving_date && fmtDate(e.leaving_date)],
              ['Leaving reason', e.leaving_reason], ['Status', e.status?.replace('_', ' ')]]],
    ['Contact', [['Email', e.email], ['Phone', s.phone_number], ['Date of birth', s.date_of_birth && fmtDate(s.date_of_birth)],
                 ['Address', e.address], ['City', e.city], ['State', e.state], ['Pincode', e.pincode]]],
    ['Government IDs', [['Aadhaar', s.aadhar_number], ['PAN', s.pan_number], ['ESIC', s.esic_number]]],
    ['Bank and pay', [['Bank', s.bank_name], ['Account number', s.bank_account_number], ['IFSC', s.ifsc_code],
                      ['Salary', s.salary != null ? `₹${Number(s.salary).toLocaleString('en-IN')}` : null]]],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{[e.first_name, e.last_name].filter(Boolean).join(' ')}</DialogTitle>
          <DialogDescription>{e.employee_code}</DialogDescription>
        </DialogHeader>
        {data && !data.ok && <p className="text-sm text-destructive">IDs, bank details, phone and salary are shown to HR and Admin only.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(([title, fields]) => (
            <div key={title} className="space-y-1.5 rounded-md border p-3">
              <div className="text-sm font-semibold">{title}</div>
              {fields.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="break-words">{isLoading && !value ? '…' : value || <span className="text-muted-foreground">—</span>}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}><Edit className="h-4 w-4 mr-2" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [view, setView] = useState<'working' | 'left' | 'all'>('working');
  // IDs, bank, phone, DOB and salary come from get_employee_sensitive (HR and Admin).
  // If they could not be loaded, saving leaves them as they are instead of blanking them.
  const [sensitiveLoaded, setSensitiveLoaded] = useState(true);
  const [viewing, setViewing] = useState<any>(null);
  const [formData, setFormData] = useState({
    employee_code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    date_of_birth: "",
    position: "",
    department: "",
    salary: "",
    aadhar_number: "",
    pan_number: "",
    esic_number: "",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    hire_date: "",
    leaving_date: "",
    leaving_reason: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      // Leaving dates that have come since the last run make those people inactive.
      await (supabase as any).rpc('employees_apply_leaving');
      const { data, error } = await (supabase as any)
        .from('employees')
        .select(`
          id,
          employee_code,
          first_name,
          last_name,
          email,
          position,
          department,
          address,
          city,
          state,
          pincode,
          status,
          hire_date,
          leaving_date,
          leaving_reason,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await (supabase as any)
        .from('employees')
        .insert([{
          employee_code: data.employee_code,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || null,
          phone_number: data.phone_number,
          date_of_birth: data.date_of_birth || null,
          position: data.position,
          department: data.department,
          salary: data.salary ? parseFloat(data.salary) : null,
          aadhar_number: data.aadhar_number || null,
          pan_number: data.pan_number || null,
          esic_number: data.esic_number || null,
          bank_name: data.bank_name || null,
          bank_account_number: data.bank_account_number || null,
          ifsc_code: data.ifsc_code || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
          ...(data.hire_date ? { hire_date: data.hire_date } : {}),
          leaving_date: data.leaving_date || null,
          leaving_reason: data.leaving_date ? data.leaving_reason || null : null,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: "Employee created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating employee", description: error.message, variant: "destructive" });
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('employees')
        .update({
          employee_code: data.employee_code,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || null,
          position: data.position,
          department: data.department,
          ...(sensitiveLoaded ? {
            phone_number: data.phone_number,
            date_of_birth: data.date_of_birth || null,
            salary: data.salary ? parseFloat(data.salary) : null,
            aadhar_number: data.aadhar_number?.trim() || null,
            pan_number: data.pan_number?.trim().toUpperCase() || null,
            esic_number: data.esic_number?.trim() || null,
            bank_name: data.bank_name?.trim() || null,
            bank_account_number: data.bank_account_number?.trim() || null,
            ifsc_code: data.ifsc_code?.trim().toUpperCase() || null,
          } : {}),
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          pincode: data.pincode?.trim() || null,
          ...(data.hire_date ? { hire_date: data.hire_date } : {}),
          leaving_date: data.leaving_date || null,
          leaving_reason: data.leaving_date ? data.leaving_reason || null : null,
        } as any)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-sensitive'] });
      toast({ title: "Employee updated successfully" });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating employee", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      employee_code: "",
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      date_of_birth: "",
      position: "",
      department: "",
      salary: "",
      aadhar_number: "",
      pan_number: "",
      esic_number: "",
      bank_name: "",
      bank_account_number: "",
      ifsc_code: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      hire_date: "",
      leaving_date: "",
      leaving_reason: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_code || !formData.first_name || !formData.last_name || (sensitiveLoaded && !formData.phone_number) || !formData.position || !formData.department) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    
    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createEmployeeMutation.mutate(formData);
    }
  };

  const handleEdit = async (employee: any) => {
    setEditingEmployee(employee);
    const { sensitive, ok } = await loadSensitive(employee.id);
    setSensitiveLoaded(ok);
    if (!ok) toast({ title: "IDs and bank details could not be loaded", description: "They will be kept as they are when you save.", variant: "destructive" });
    setFormData({
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      last_name: employee.last_name ?? "",
      email: employee.email ?? "",
      hire_date: employee.hire_date ?? "",
      leaving_date: employee.leaving_date ?? "",
      leaving_reason: employee.leaving_reason ?? "",
      phone_number: sensitive.phone_number || "",
      date_of_birth: sensitive.date_of_birth || "",
      position: employee.position,
      department: employee.department,
      salary: sensitive.salary?.toString() || "",
      aadhar_number: sensitive.aadhar_number || "",
      pan_number: sensitive.pan_number || "",
      esic_number: sensitive.esic_number || "",
      bank_name: sensitive.bank_name || "",
      bank_account_number: sensitive.bank_account_number || "",
      ifsc_code: sensitive.ifsc_code || "",
      address: employee.address || "",
      city: employee.city || "",
      state: employee.state || "",
      pincode: employee.pincode || "",
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingEmployee(null);
    setSensitiveLoaded(true);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Employee Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
              <DialogDescription>
                Enter employee details including personal information, government IDs, and bank details.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_code">Employee Code *</Label>
                  <Input
                    id="employee_code"
                    value={formData.employee_code}
                    onChange={(e) => handleInputChange('employee_code', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone_number">Phone Number *</Label>
                  <Input
                    id="phone_number" disabled={!sensitiveLoaded}
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth" disabled={!sensitiveLoaded}
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => handleInputChange('position', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="hire_date">Joining Date</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => handleInputChange('hire_date', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="leaving_date">Leaving Date</Label>
                  <Input
                    id="leaving_date"
                    type="date"
                    min={formData.hire_date || undefined}
                    value={formData.leaving_date}
                    onChange={(e) => handleInputChange('leaving_date', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    From this date the employee is inactive and their ERP login is switched off.
                  </p>
                </div>

                {formData.leaving_date && (
                  <div>
                    <Label htmlFor="leaving_reason">Reason for Leaving</Label>
                    <Input
                      id="leaving_reason"
                      placeholder="Resigned, contract ended…"
                      value={formData.leaving_reason}
                      onChange={(e) => handleInputChange('leaving_reason', e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary" disabled={!sensitiveLoaded}
                    type="number"
                    step="0.01"
                    value={formData.salary}
                    onChange={(e) => handleInputChange('salary', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Government IDs</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="aadhar_number">Aadhar Number</Label>
                    <Input
                      id="aadhar_number" disabled={!sensitiveLoaded}
                      value={formData.aadhar_number}
                      onChange={(e) => handleInputChange('aadhar_number', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="pan_number">PAN Number</Label>
                    <Input
                      id="pan_number" disabled={!sensitiveLoaded}
                      value={formData.pan_number}
                      onChange={(e) => handleInputChange('pan_number', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="esic_number">ESIC Number</Label>
                    <Input
                      id="esic_number" disabled={!sensitiveLoaded}
                      value={formData.esic_number}
                      onChange={(e) => handleInputChange('esic_number', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name" disabled={!sensitiveLoaded}
                      value={formData.bank_name}
                      onChange={(e) => handleInputChange('bank_name', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="bank_account_number">Account Number</Label>
                    <Input
                      id="bank_account_number" disabled={!sensitiveLoaded}
                      value={formData.bank_account_number}
                      onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ifsc_code">IFSC Code</Label>
                    <Input
                      id="ifsc_code" disabled={!sensitiveLoaded}
                      value={formData.ifsc_code}
                      onChange={(e) => handleInputChange('ifsc_code', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}>
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>Manage employee information and details</CardDescription>
            </div>
            <div className="flex rounded-md border p-0.5 text-sm">
              {([['working', 'Working'], ['left', 'Left'], ['all', 'All']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)}
                        className={`rounded px-3 py-1 ${view === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading employees...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees?.filter((e: any) => view === 'all' || (view === 'left') === !!(e.leaving_date && e.status !== 'active' && e.status !== 'on_leave' && e.leaving_date <= todayIso())).map((employee: any) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.employee_code}</TableCell>
                    <TableCell>{[employee.first_name, employee.last_name].filter(Boolean).join(' ')}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {employee.status.replace('_', ' ')}
                      </Badge>
                      {employee.leaving_date && (
                        <div className="mt-1 text-xs text-muted-foreground" title={employee.leaving_reason ?? undefined}>
                          {employee.leaving_date <= todayIso() ? 'Left' : 'Leaving'} {fmtDate(employee.leaving_date)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" title="View details" onClick={() => setViewing(employee)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" title="Edit" onClick={() => handleEdit(employee)}>
                          <Edit className="h-4 w-4" />
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
      {viewing && <EmployeeDetails employee={viewing} onClose={() => setViewing(null)} onEdit={() => { const e = viewing; setViewing(null); handleEdit(e); }} />}
    </div>
  );
}
