import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  onUserCreated?: (userId?: string) => void;
}

/**
 * Pull the real message out of a supabase.functions.invoke() failure.
 * `invoke` throws a FunctionsHttpError whose own `message` is the useless
 * "non-2xx status code" string — the readable reason is in the response body.
 */
export async function readFunctionError(error: any, fallback: string): Promise<string> {
  try {
    const res = error?.context;
    if (res && typeof res.text === "function") {
      const raw = await res.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.message) return String(parsed.message);
          if (parsed?.error) return String(parsed.error);
        } catch {
          return raw;
        }
      }
    }
  } catch {
    /* ignore and fall through */
  }
  if (error?.message && !/non-2xx/i.test(error.message)) return error.message;
  return fallback;
}

export function CreateUserForm({ onUserCreated }: CreateUserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [plantIds, setPlantIds] = useState<Set<string>>(new Set());
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());

  const { data: plants = [] } = useQuery({
    queryKey: ["ac-all-plants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plants")
        .select("id, code, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["ac-all-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<CreateUserFormData>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
    },
  });

  const toggle = (
    set: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) =>
    set((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
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
      const { data: result, error } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: data.email.trim(),
            password: data.password,
            fullName: data.fullName?.trim() || "",
          },
        },
      );

      if (error) {
        toast.error(await readFunctionError(error, "Failed to create user"));
        return;
      }

      if (!result?.success) {
        toast.error(result?.message || "Failed to create user");
        return;
      }

      const newUserId: string | undefined = result?.user?.id;

      // Assign plants and departments as the signed-in admin — these RPCs are
      // admin-guarded and depend on the caller's identity, so they cannot run
      // inside the edge function.
      const assignmentErrors: string[] = [];
      if (newUserId) {
        const [p, d] = await Promise.all([
          supabase.rpc("set_user_plants", {
            p_user_id: newUserId,
            p_plant_ids: Array.from(plantIds),
          }),
          supabase.rpc("set_user_departments", {
            p_user_id: newUserId,
            p_department_ids: Array.from(deptIds),
          }),
        ]);
        if (p.error) assignmentErrors.push(`plants: ${p.error.message}`);
        if (d.error) assignmentErrors.push(`departments: ${d.error.message}`);
      }

      if (assignmentErrors.length > 0) {
        toast.error(
          `User created, but access could not be assigned — ${assignmentErrors.join(
            "; ",
          )}. Set it from the user's panel.`,
        );
      } else {
        toast.success(result.message);
      }

      form.reset();
      setPlantIds(new Set());
      setDeptIds(new Set());
      onUserCreated?.(newUserId);
    } catch (error: any) {
      toast.error(
        await readFunctionError(
          error,
          "An unexpected error occurred while creating the user",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl border-0 shadow-none">
      <CardHeader className="px-0">
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create new user
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sets up the sign-in account, the user record and their access.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              rules={{
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
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
                    message: "Password must be at least 6 characters",
                  },
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

            <div className="space-y-2">
              <Label>Plants</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {plants.map((p: any) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={plantIds.has(p.id)}
                      onCheckedChange={() => toggle(setPlantIds, p.id)}
                    />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {p.code}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Departments</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {departments.map((d: any) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={deptIds.has(d.id)}
                      onCheckedChange={() => toggle(setDeptIds, d.id)}
                    />
                    <div className="font-medium">{d.name}</div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Departments decide which modules the user can open.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              Create user
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
