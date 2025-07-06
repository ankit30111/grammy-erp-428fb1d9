
import React, { useState, useEffect } from "react";
import { CreateUserForm } from "./CreateUserForm";
import { UsersList } from "./UsersList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus } from "lucide-react";
import { AdminGuard } from "@/components/Auth/AdminGuard";

export function UserManagementPage() {
  return (
    <AdminGuard>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>
        
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create User
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage Users
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="mt-6">
            <div className="flex justify-center">
              <CreateUserForm />
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="mt-6">
            <UsersList />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
