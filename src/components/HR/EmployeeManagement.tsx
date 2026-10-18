import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Eye, IdCard, Search, Trash2, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PHOTO_BUCKET, makeIdCards, preparePhoto } from "@/lib/employeeIdCard";
import { EmployeePhoto, EmployeeProfile, employeeName, loadSensitive } from "./EmployeeProfile";

/** Today in India, as YYYY-MM-DD (leaving dates are compared with it). */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const fmtDate = (iso: string) => iso.split('-').reverse().join('-');

function PhotoPicker({ current, file, changed, onPick, onRemove, onUndo }: {
  current: string | null; file: File | null; changed: boolean;
  onPick: (f: File) => void; onRemove: () => void; onUndo: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
      {preview ? <img src={preview} alt="New photo" className="aspect-[3/4] w-[5.7rem] rounded-md border object-cover" />
        : <EmployeePhoto path={current} className="w-[5.7rem]" />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Photo <span className="font-normal text-muted-foreground">(JPG / PNG, passport style; printed on the ID card)</span></div>
        <div className="text-xs text-muted-foreground">{file ? `${file.name} · saved when you press Create / Update` : changed ? 'Will be removed when you press Update' : current ? 'On file' : 'No photo yet'}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {changed ? <Button type="button" variant="ghost" size="sm" onClick={onUndo}>Undo</Button> : (
          <Button asChild type="button" variant="outline" size="sm" className="cursor-pointer">
            <label>
              <Upload className="h-4 w-4 mr-1" /> {current ? 'Replace' : 'Upload'}
              <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="sr-only"
                     onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) onPick(f); }} />
            </label>
          </Button>
        )}
        {current && !changed && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4 mr-1" /> Remove</Button>
        )}
      </div>
    </div>
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
  const [photo, setPhoto] = useState<{ file: File | null; remove: boolean }>({ file: null, remove: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [search, setSearch] = useState('');

  /** Upload the picked photo (or clear it) after the employee row is saved. */
  const savePhoto = async (id: string, code: string, oldPath: string | null) => {
    if (!photo.file && !photo.remove) return;
    let path: string | null = null;
    if (photo.file) {
      const blob = await preparePhoto(photo.file);
      path = `${String(code).replace(/[^\w.-]+/g, '_')}/${id}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(`Saved, but the photo did not upload: ${error.message}`);
    }
    const { error } = await (supabase as any).from('employees').update({ photo_path: path }).eq('id', id);
    if (error) throw error;
    if (oldPath && oldPath !== path) await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
  };

  const printCards = async (list: any[], layout: 'card' | 'a4') => {
    if (!list.length) return;
    setPrinting(true);
    try {
      const missing = await makeIdCards(list, layout);
      toast({ title: `ID card${list.length > 1 ? 's' : ''} ready`, description: missing ? `${missing} without a photo; upload it in Edit and print again.` : undefined });
    } catch (e: any) {
      toast({ title: "Could not make the ID cards", description: e?.message, variant: "destructive" });
    } finally { setPrinting(false); }
  };
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
    permanent_address: "",
    permanent_city: "",
    permanent_state: "",
    permanent_pincode: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
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
          permanent_address,
          permanent_city,
          permanent_state,
          permanent_pincode,
          emergency_contact_name,
          emergency_contact_phone,
          photo_path,
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
      const { data: created, error } = await (supabase as any)
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
          permanent_address: data.permanent_address?.trim() || null,
          permanent_city: data.permanent_city?.trim() || null,
          permanent_state: data.permanent_state?.trim() || null,
          permanent_pincode: data.permanent_pincode?.trim() || null,
          emergency_contact_name: data.emergency_contact_name?.trim() || null,
          emergency_contact_phone: data.emergency_contact_phone?.trim() || null,
          ...(data.hire_date ? { hire_date: data.hire_date } : {}),
          leaving_date: data.leaving_date || null,
          leaving_reason: data.leaving_date ? data.leaving_reason || null : null,
        }]).select('id').single();
      
      if (error) throw error;
      await savePhoto(created.id, data.employee_code, null);
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
          permanent_address: data.permanent_address?.trim() || null,
          permanent_city: data.permanent_city?.trim() || null,
          permanent_state: data.permanent_state?.trim() || null,
          permanent_pincode: data.permanent_pincode?.trim() || null,
          emergency_contact_name: data.emergency_contact_name?.trim() || null,
          emergency_contact_phone: data.emergency_contact_phone?.trim() || null,
          ...(data.hire_date ? { hire_date: data.hire_date } : {}),
          leaving_date: data.leaving_date || null,
          leaving_reason: data.leaving_date ? data.leaving_reason || null : null,
        } as any)
        .eq('id', id);
      
      if (error) throw error;
      await savePhoto(id, data.employee_code, editingEmployee?.photo_path ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-sensitive'] });
      queryClient.invalidateQueries({ queryKey: ['employee-photo'] });
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
      permanent_address: "",
      permanent_city: "",
      permanent_state: "",
      permanent_pincode: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
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
    setPhoto({ file: null, remove: false });
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
      permanent_address: employee.permanent_address || "",
      permanent_city: employee.permanent_city || "",
      permanent_state: employee.permanent_state || "",
      permanent_pincode: employee.permanent_pincode || "",
      emergency_contact_name: employee.emergency_contact_name || "",
      emergency_contact_phone: employee.emergency_contact_phone || "",
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingEmployee(null);
    setSensitiveLoaded(true);
    setPhoto({ file: null, remove: false });
    resetForm();
    setIsDialogOpen(true);
  };

  const q = search.trim().toLowerCase();
  const shown = (employees ?? [])
    .filter((e: any) => view === 'all' || (view === 'left') === !!(e.leaving_date && e.status !== 'active' && e.status !== 'on_leave' && e.leaving_date <= todayIso()))
    .filter((e: any) => !q || [e.employee_code, e.first_name, e.last_name, e.position, e.department, e.email, e.city]
      .some((v) => String(v ?? '').toLowerCase().includes(q)));

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
              <DialogDescription>
                Enter employee details including personal information, government IDs, and bank details.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <PhotoPicker current={photo.remove ? null : editingEmployee?.photo_path ?? null} file={photo.file}
                           onPick={(file) => setPhoto({ file, remove: false })}
                           onRemove={() => setPhoto({ file: null, remove: true })}
                           onUndo={() => setPhoto({ file: null, remove: false })} changed={!!photo.file || photo.remove} />
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

              <div className="space-y-3">
                <h3 className="text-lg font-medium">Current Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={formData.state} onChange={(e) => handleInputChange('state', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input id="pincode" inputMode="numeric" value={formData.pincode} onChange={(e) => handleInputChange('pincode', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-medium">Permanent Address</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormData((f) => ({ ...f, permanent_address: f.address, permanent_city: f.city, permanent_state: f.state, permanent_pincode: f.pincode }))}>
                    Same as current address
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="permanent_address">Address</Label>
                    <Input id="permanent_address" value={formData.permanent_address} onChange={(e) => handleInputChange('permanent_address', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="permanent_city">City</Label>
                    <Input id="permanent_city" value={formData.permanent_city} onChange={(e) => handleInputChange('permanent_city', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="permanent_state">State</Label>
                    <Input id="permanent_state" value={formData.permanent_state} onChange={(e) => handleInputChange('permanent_state', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="permanent_pincode">Pincode</Label>
                    <Input id="permanent_pincode" inputMode="numeric" value={formData.permanent_pincode} onChange={(e) => handleInputChange('permanent_pincode', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Name and relation</Label>
                    <Input id="emergency_contact_name" placeholder="e.g. Ramesh Kumar (father)" value={formData.emergency_contact_name} onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_phone">Phone</Label>
                    <Input id="emergency_contact_phone" inputMode="tel" value={formData.emergency_contact_phone} onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)} />
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

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search code, name, position, department, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex rounded-md border p-0.5 text-sm">
              {([['working', 'Working'], ['left', 'Left'], ['all', 'All']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)}
                        className={`rounded px-3 py-1.5 ${view === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
            <Button onClick={handleAddNew}><Plus className="h-4 w-4 mr-1" /> Add employee</Button>
          </div>

          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{shown.length} employee{shown.length === 1 ? '' : 's'}{search ? ' found' : ''}</span>
            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{selected.size} selected</span>
                <Button size="sm" variant="outline" disabled={printing} onClick={() => printCards((employees ?? []).filter((e: any) => selected.has(e.id)), 'card')}>
                  <IdCard className="h-4 w-4 mr-1" /> ID cards (card size)
                </Button>
                <Button size="sm" variant="outline" disabled={printing} onClick={() => printCards((employees ?? []).filter((e: any) => selected.has(e.id)), 'a4')}>
                  <IdCard className="h-4 w-4 mr-1" /> ID cards (A4 sheet)
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            ) : <span className="text-xs text-muted-foreground">Tick employees to print several ID cards at once</span>}
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading employees…</p>
          ) : !shown.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{search ? 'No employee matches the search.' : 'No employees here.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all shown"
                              checked={shown.length > 0 && shown.every((e: any) => selected.has(e.id))}
                              onCheckedChange={(v) => setSelected(v ? new Set(shown.map((e: any) => e.id)) : new Set())} />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="whitespace-nowrap">Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[8.5rem] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((employee: any) => {
                  const left = employee.leaving_date && employee.leaving_date <= todayIso();
                  return (
                  <TableRow key={employee.id} className="cursor-pointer" onClick={() => setViewing(employee)}>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox aria-label={`Select ${employee.employee_code}`} checked={selected.has(employee.id)}
                                onCheckedChange={(v) => setSelected((cur) => { const n = new Set(cur); v ? n.add(employee.id) : n.delete(employee.id); return n; })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <EmployeePhoto path={employee.photo_path} className="w-9" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{employeeName(employee)}</div>
                          <div className="font-mono text-xs text-muted-foreground">{employee.employee_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{employee.position}</TableCell>
                    <TableCell className="whitespace-nowrap">{employee.department}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{employee.hire_date ? fmtDate(employee.hire_date) : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>{employee.status.replace('_', ' ')}</Badge>
                      {employee.leaving_date && (
                        <div className="mt-1 text-xs text-muted-foreground" title={employee.leaving_reason ?? undefined}>
                          {left ? 'Left' : 'Leaving'} {fmtDate(employee.leaving_date)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View details and ID card" onClick={() => setViewing(employee)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Print ID card" disabled={printing} onClick={() => printCards([employee], 'card')}><IdCard className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => handleEdit(employee)}><Edit className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {viewing && <EmployeeProfile employee={viewing} printing={printing} onClose={() => setViewing(null)}
                                   onEdit={() => { const e = viewing; setViewing(null); handleEdit(e); }}
                                   onCard={(layout) => printCards([viewing], layout)} />}
    </div>
  );
}
