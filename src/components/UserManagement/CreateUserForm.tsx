
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail } from "lucide-react";

interface CreateUserFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
}

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

export function CreateUserForm({ onUserCreated }: CreateUserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<CreateUserFormData>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
    },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (data.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      // Use secure Edge Function to create user (admin-only)
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName || ''
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Failed to create user: " + error.message);
        return;
      }

      if (!result.success) {
        console.error("User creation failed:", result.message);
        toast.error(result.message);
        return;
      }

      console.log("User created successfully:", result.user);
      toast.success(result.message);
      form.reset();
      
      // Notify parent component to refresh user list
      if (onUserCreated) {
        onUserCreated();
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("An unexpected error occurred while creating the user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create New Authentication User
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a new user in Supabase Authentication
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              rules={{ 
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address"
                }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="user@company.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                rules={{ 
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters"
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                rules={{ required: "Please confirm password" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Users created here will be able to sign in to the system</li>
                <li>• Email will be automatically confirmed for admin-created users</li>
                <li>• All users currently have universal access to all features</li>
                <li>• The new user will appear in the "Manage Users" tab after creation</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              Create Authentication User
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
