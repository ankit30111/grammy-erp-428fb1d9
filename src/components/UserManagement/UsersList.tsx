
import React, { useState, useEffect } from "react";
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
import { Loader2, Mail, Calendar, CheckCircle, XCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuthUsers();
  }, []);

  const fetchAuthUsers = async () => {
    try {
      setLoading(true);
      
      // First try to get current session to check if user has admin access
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Authentication required");
        return;
      }

      // Use the admin API to list all users
      const { data, error } = await supabase.auth.admin.listUsers();

      if (error) {
        console.error("Error fetching auth users:", error);
        toast.error("Failed to fetch users. Admin access may be required.");
        return;
      }

      console.log("Fetched auth users:", data.users);
      // Filter users to only include those with valid email addresses
      const validUsers = data.users.filter((user): user is User => 
        user.email !== undefined && user.email !== null
      );
      setUsers(validUsers);
    } catch (error) {
      console.error("Error fetching auth users:", error);
      toast.error("An unexpected error occurred while fetching users");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (user: User) => {
    if (!user.email_confirmed_at) {
      return <Badge variant="secondary">Unconfirmed</Badge>;
    }
    if (user.last_sign_in_at) {
      return <Badge variant="default">Active</Badge>;
    }
    return <Badge variant="outline">Registered</Badge>;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading users from Authentication...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Authenticated Users ({users.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Users registered in Supabase Authentication
        </p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No authenticated users found.</p>
            <p className="text-sm">Users need to be created through Supabase Auth.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchAuthUsers}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Refresh Users
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Email Confirmed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {user.email}
                      </div>
                      {user.user_metadata?.full_name && (
                        <div className="text-sm text-muted-foreground">
                          {user.user_metadata.full_name}
                        </div>
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
                      {user.last_sign_in_at ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {formatDate(user.last_sign_in_at)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-gray-400" />
                          Never
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.email_confirmed_at ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Confirmed
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-orange-500" />
                          Pending
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
