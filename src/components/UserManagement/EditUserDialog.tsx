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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  department_id?: string;
  password_hash?: string;
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
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "user",
    is_active: true,
    department_id: "",
  });

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        role: user.role || "user",
        is_active: user.is_active,
        department_id: user.department_id || "",
      });
      fetchDepartments();
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

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("user_accounts")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active,
          department_id: formData.department_id || null,
        })
        .eq("id", user.id);

      if (error) throw error;

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
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id || "unassigned"}
                onValueChange={(value) => setFormData({ ...formData, department_id: value === "unassigned" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Not assigned</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            {isAdmin && user?.password_hash && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center gap-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPassword ? 'Hide' : 'View'} Password
                  </Button>
                </div>
                
                {showPassword && (
                  <div className="space-y-2">
                    <Alert className="border-destructive/50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Security Warning:</strong> This is the hashed password from the database. 
                        Never share this information. For security purposes, passwords are stored encrypted.
                      </AlertDescription>
                    </Alert>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Hashed Password:</p>
                      <code className="text-xs break-all font-mono">
                        {user.password_hash}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            )}
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