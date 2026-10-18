import { useEffect, useState } from "react";
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
import { Plus, Edit, Eye, IdCard, ImageOff, Trash2, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { PHOTO_BUCKET, makeIdCards, preparePhoto } from "@/lib/employeeIdCard";

/** Today in India, as YYYY-MM-DD (leaving dates are compared with it). */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const fmtDate = (iso: string) => iso.split('-').reverse().join('-');

async function loadSensitive(id: string) {
  const { data, error } = await (supabase as any).rpc('get_employee_sensitive', { p_employee_id: id });
  return { ok: !error, sensitive: (Array.isArray(data) ? data[0] : data) ?? {} };
}

/** Everything on file for one employee, read only. */
function EmployeeDetails({ employee: e, onClose, onEdit, onCard }: { employee: any; onClose: () => void; onEdit: () => void; onCard: (layout: 'card' | 'a4') => void }) {
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
                 ['Emergency contact', [e.emergency_contact_name, e.emergency_contact_phone].filter(Boolean).join(' · ')]]],
    ['Current address', [['Address', e.address], ['City', e.city], ['State', e.state], ['Pincode', e.pincode]]],
    ['Permanent address', [['Address', e.permanent_address], ['City', e.permanent_city], ['State', e.permanent_state], ['Pincode', e.permanent_pincode]]],
    ['Government IDs', [['Aadhaar', s.aadhar_number], ['PAN', s.pan_number], ['ESIC', s.esic_number]]],
    ['Bank and pay', [['Bank', s.bank_name], ['Account number', s.bank_account_number], ['IFSC', s.ifsc_code],
                      ['Salary', s.salary != null ? `₹${Number(s.salary).toLocaleString('en-IN')}` : null]]],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 pr-8">
            <EmployeePhoto path={e.photo_path} className="h-24 w-[4.9rem]" />
            <div>
              <DialogTitle>{[e.first_name, e.last_name].filter(Boolean).join(' ')}</DialogTitle>
              <DialogDescription>{e.employee_code}{e.position ? ` · ${e.position}` : ''}{e.department ? ` · ${e.department}` : ''}</DialogDescription>
            </div>
          </div>
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
          <Button variant="outline" onClick={() => onCard('card')}><IdCard className="h-4 w-4 mr-2" /> ID card</Button>
          <Button variant="outline" onClick={() => onCard('a4')}><IdCard className="h-4 w-4 mr-2" /> ID card on A4</Button>
          <Button onClick={onEdit}><Edit className="h-4 w-4 mr-2" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The employee's photo (ID-card shape), or a placeholder. */
function EmployeePhoto({ path, className }: { path?: string | null; className?: string }) {
  const { data: url } = useSignedStorageUrl(PHOTO_BUCKET, path ?? null);
  return url
    ? <img src={url} alt="Employee photo" className={`shrink-0 rounded-md border object-cover ${className ?? ''}`} />
    : <div className={`flex shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground ${className ?? ''}`}><ImageOff className="h-5 w-5" /></div>;
}

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
      {preview ? <img src={preview} alt="New photo" className="h-28 w-[5.7rem] rounded-md border object-cover" />
        : <EmployeePhoto path={current} className="h-28 w-[5.7rem]" />}
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

  const shown = (employees ?? []).filter((e: any) => view === 'all' || (view === 'left') === !!(e.leaving_date && e.status !== 'active' && e.status !== 'on_leave' && e.leaving_date <= todayIso()));

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
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>Manage employee information and details</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="outline" disabled={printing} onClick={() => printCards((employees ?? []).filter((e: any) => selected.has(e.id)), 'card')}>
                  <IdCard className="h-4 w-4 mr-1" /> ID cards
                </Button>
                <Button size="sm" variant="outline" disabled={printing} onClick={() => printCards((employees ?? []).filter((e: any) => selected.has(e.id)), 'a4')}>
                  <IdCard className="h-4 w-4 mr-1" /> ID cards on A4
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </>
            )}
            <div className="flex rounded-md border p-0.5 text-sm">
              {([['working', 'Working'], ['left', 'Left'], ['all', 'All']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)}
                        className={`rounded px-3 py-1 ${view === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
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
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all shown"
                              checked={shown.length > 0 && shown.every((e: any) => selected.has(e.id))}
                              onCheckedChange={(v) => setSelected(v ? new Set(shown.map((e: any) => e.id)) : new Set())} />
                  </TableHead>
                  <TableHead className="w-14">Photo</TableHead>
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
                {shown.map((employee: any) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Checkbox aria-label={`Select ${employee.employee_code}`} checked={selected.has(employee.id)}
                                onCheckedChange={(v) => setSelected((cur) => { const n = new Set(cur); v ? n.add(employee.id) : n.delete(employee.id); return n; })} />
                    </TableCell>
                    <TableCell><EmployeePhoto path={employee.photo_path} className="h-10 w-8" /></TableCell>
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
      {viewing && <EmployeeDetails employee={viewing} onClose={() => setViewing(null)} onEdit={() => { const e = viewing; setViewing(null); handleEdit(e); }}
                                   onCard={(layout) => printCards([viewing], layout)} />}
    </div>
  );
}
