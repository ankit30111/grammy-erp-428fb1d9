import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Trash2, Eye, EyeOff, RefreshCw, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  department_id?: string;
  departments?: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface EditUserDialogProps {
  user: UserAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onUserUpdated }: EditUserDialogProps) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  // Set of selected department IDs. A user may belong to 0..N departments.
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  // ID of the "primary" department — shown in the Manage Users table's
  // single-department column and stored in user_accounts.department_id.
  // Must be one of selectedDeptIds (or empty if none are selected).
  const [primaryDeptId, setPrimaryDeptId] = useState<string>("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "user",
    is_active: true,
    password: "",
  });

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        role: user.role || "user",
        is_active: user.is_active,
        password: "",
      });
      setShowPasswordSection(false);
      setShowPassword(false);
      // Reset selection so stale state from the previous user never bleeds
      // into the next dialog open.
      setSelectedDeptIds(new Set());
      setPrimaryDeptId("");
      void fetchDepartments();
      void fetchUserDepartments(user.id);
    }
  }, [user, open]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to fetch departments");
    }
  };

  const fetchUserDepartments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .rpc("get_user_departments", { p_user_id: userId });

      if (error) throw error;

      const ids = new Set<string>(
        (data || []).map((row: { department_id: string }) => row.department_id),
      );
      const primary = (data || []).find(
        (row: { is_primary: boolean }) => row.is_primary,
      )?.department_id as string | undefined;

      setSelectedDeptIds(ids);
      setPrimaryDeptId(primary ?? (ids.size > 0 ? Array.from(ids)[0] : ""));
    } catch (error) {
      console.error("Error fetching user departments:", error);
      toast.error("Failed to load the user's current departments");
    }
  };

  const toggleDepartment = (id: string, checked: boolean) => {
    const next = new Set(selectedDeptIds);
    if (checked) {
      next.add(id);
      // If nothing was primary yet, make this the primary.
      if (!primaryDeptId) setPrimaryDeptId(id);
    } else {
      next.delete(id);
      // If the primary was just unchecked, fall back to the first remaining
      // selection (or clear it if none remain).
      if (primaryDeptId === id) {
        const fallback = Array.from(next)[0] ?? "";
        setPrimaryDeptId(fallback);
      }
    }
    setSelectedDeptIds(next);
  };

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
  };

  const handleSave = async () => {
    if (!user) return;

    // Basic client-side sanity: if anything is selected, a primary must be set.
    if (selectedDeptIds.size > 0 && !primaryDeptId) {
      toast.error("Pick a primary department (click the star)");
      return;
    }

    try {
      setLoading(true);

      // Update user_accounts for non-department fields. department_id is
      // managed by the set_user_departments RPC below so we don't write it
      // from two places.
      const { error: updateError } = await supabase
        .from("user_accounts")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Replace the user_departments rows atomically via the admin-only RPC.
      // The array is ordered so the primary is first — the RPC uses ids[1]
      // (SQL 1-indexed) as the legacy user_accounts.department_id.
      const orderedIds: string[] = primaryDeptId
        ? [primaryDeptId, ...Array.from(selectedDeptIds).filter((id) => id !== primaryDeptId)]
        : [];

      const { error: deptError } = await supabase.rpc("set_user_departments", {
        p_user_id: user.id,
        p_department_ids: orderedIds,
      });

      if (deptError) {
        console.error("Error saving departments:", deptError);
        toast.error("Failed to save department assignments: " + deptError.message);
        return;
      }

      // Update password if provided
      if (formData.password) {
        if (formData.password.length < 6) {
          toast.error("Password must be at least 6 characters long");
          return;
        }

        const { error: passwordError } = await supabase.functions.invoke('admin-update-user-password', {
          body: {
            userId: user.id,
            newPassword: formData.password
          }
        });

        if (passwordError) {
          console.error("Password update error:", passwordError);
          toast.error("Failed to update password: " + passwordError.message);
          return;
        }
      }

      toast.success("User updated successfully");
      onUserUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("user_accounts")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      toast.success("User deleted successfully");
      onUserUpdated();
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Departments</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedDeptIds.size} selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tick every department this user should belong to. Click the star to
                mark one as the primary (shown in the user list).
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {departments.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No departments defined yet.
                  </div>
                ) : (
                  departments.map((dept) => {
                    const checked = selectedDeptIds.has(dept.id);
                    const isPrimary = primaryDeptId === dept.id;
                    return (
                      <div
                        key={dept.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <Checkbox
                          id={`dept-${dept.id}`}
                          checked={checked}
                          onCheckedChange={(val) =>
                            toggleDepartment(dept.id, val === true)
                          }
                        />
                        <Label
                          htmlFor={`dept-${dept.id}`}
                          className="flex-1 cursor-pointer text-sm font-normal"
                        >
                          {dept.name}
                        </Label>
                        {checked && (
                          <Button
                            type="button"
                            variant={isPrimary ? "default" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setPrimaryDeptId(dept.id)}
                            title={isPrimary ? "Primary department" : "Make primary"}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                isPrimary ? "fill-current" : ""
                              }`}
                            />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-xs h-7"
                >
                  {showPasswordSection ? "Cancel" : "Change Password"}
                </Button>
              </div>
              
              {showPasswordSection && (
                <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password (min 6 characters)"
                      className="pr-20"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="h-8 w-8 p-0"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={generatePassword}
                        className="h-8 w-8 p-0"
                        title="Generate password"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to keep current password unchanged
                  </p>
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete User
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{user.full_name || user.email}"? 
              This action cannot be undone and will permanently remove the user from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}