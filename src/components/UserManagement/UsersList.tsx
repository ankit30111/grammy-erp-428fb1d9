
import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, Calendar, Shield, Edit } from "lucide-react";
import { EditUserDialog } from "./EditUserDialog";

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

export interface UsersListRef {
  refreshUsers: () => void;
}

export const UsersList = forwardRef<UsersListRef>((props, ref) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Use the SECURITY DEFINER admin RPC. The role column is now revoked
      // from direct table queries, and this RPC enforces admin-only access
      // server-side.
      const { data, error } = await supabase
        .rpc("list_user_accounts_for_admin");

      if (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to fetch users from database.");
        return;
      }

      // RPC returns a flat shape with department_name; reshape so the
      // existing render code (which reads `departments.name`) keeps working.
      const reshaped = (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        department_id: u.department_id ?? undefined,
        departments: u.department_name ? { name: u.department_name } : undefined,
      }));
      setUsers(reshaped);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("An unexpected error occurred while fetching users");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (user: UserAccount) => {
    if (!user.is_active) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Shield className="h-3 w-3" />
        Admin
      </Badge>;
    }
    return <Badge variant="outline">User</Badge>;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleUserUpdated = () => {
    fetchUsers();
  };

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshUsers: fetchUsers
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading users from database...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          System Users ({users.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Users registered in the system
        </p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found.</p>
            <p className="text-sm">Users need to be created through the system.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchUsers}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Refresh Users
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Details</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{user.email}</div>
                          {user.full_name && (
                            <div className="text-sm text-muted-foreground">
                              {user.full_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      {user.departments?.name || (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(user.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <EditUserDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUserUpdated={handleUserUpdated}
      />
    </Card>
  );
});
