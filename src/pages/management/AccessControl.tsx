import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { AdminGuard } from "@/components/Auth/AdminGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { CreateUserForm } from "@/components/UserManagement/CreateUserForm";
import { toast } from "sonner";
import { ShieldCheck, Users, Building2, Loader2, Save, AlertTriangle, UserPlus, KeyRound } from "lucide-react";

/**
 * Modules surfaced in the UI. Keep aligned with KNOWN_MODULES in AuthContext
 * and the seed in the access-control migration.
 */
const MODULES: { key: string; label: string; hint: string }[] = [
  { key: "commerce", label: "Commerce", hint: "Purchase, Planning, Sales & Imports" },
  { key: "store", label: "Store", hint: "Inventory, GRN, store ops" },
  { key: "production", label: "Production", hint: "Production orders & finished goods" },
  { key: "quality", label: "Quality", hint: "IQC, PQC, OQC, complaints" },
  { key: "rnd", label: "R&D", hint: "NPD and pre-existing" },
  { key: "dash", label: "DASH", hint: "DASH brand workspace" },
  { key: "hr", label: "HR", hint: "Human Resources" },
  { key: "approvals", label: "Approvals", hint: "Management / Admin only" },
];

export default function AccessControl() {
  return (
    <AdminGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-7 w-7" />
              Users &amp; Access
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Create users and decide who can see what. Users belong to plants
              and departments; departments unlock modules.
            </p>
          </div>

          <Tabs defaultValue="users" className="w-full">
            <TabsList>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" /> Users
              </TabsTrigger>
              <TabsTrigger value="modules" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Departments × Modules
              </TabsTrigger>
              <TabsTrigger value="plants" className="gap-2">
                <Building2 className="h-4 w-4" /> Plants
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-6">
              <UsersTab />
            </TabsContent>
            <TabsContent value="modules" className="mt-6">
              <ModulesMatrixTab />
            </TabsContent>
            <TabsContent value="plants" className="mt-6">
              <PlantsTabHint />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </AdminGuard>
  );
}

// ---------------------------------------------------------------------------
// USERS TAB
// ---------------------------------------------------------------------------
function UsersTab() {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["ac-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_user_accounts_for_admin");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["ac-all-plants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plants")
        .select("id, code, name, is_active")
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

  const selectedUser = useMemo(
    () => users.find((u: any) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      {/* Users list */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
          <CardDescription>Select a user to edit their access.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {users.map((u: any) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition ${
                    u.id === selectedUserId ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {u.full_name || u.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {u.role === "admin" && (
                        <Badge variant="default" className="text-[10px]">admin</Badge>
                      )}
                      {!u.is_active && (
                        <Badge variant="secondary" className="text-[10px]">inactive</Badge>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Editor */}
      {selectedUser ? (
        <UserAccessEditor
          key={selectedUser.id}
          user={selectedUser}
          plants={plants}
          departments={departments}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ac-users"] })}
        />
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Select a user on the left to manage their plants and departments.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserAccessEditor({
  user,
  plants,
  departments,
  onSaved,
}: {
  user: any;
  plants: any[];
  departments: any[];
  onSaved: () => void;
}) {
  const { data: userPlants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["ac-user-plants", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_plants", { p_user_id: user.id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: userDepts = [], isLoading: deptsLoading } = useQuery({
    queryKey: ["ac-user-depts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_departments", { p_user_id: user.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedPlantIds, setSelectedPlantIds] = useState<Set<string>>(new Set());
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!plantsLoading) {
      setSelectedPlantIds(new Set(userPlants.map((p: any) => p.plant_id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantsLoading, userPlants]);

  useEffect(() => {
    if (!deptsLoading) {
      setSelectedDeptIds(new Set(userDepts.map((d: any) => d.department_id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptsLoading, userDepts]);

  const togglePlant = (id: string) => {
    setSelectedPlantIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleDept = (id: string) => {
    setSelectedDeptIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const plantIds = Array.from(selectedPlantIds);
      const deptIds = Array.from(selectedDeptIds);
      const [p, d] = await Promise.all([
        supabase.rpc("set_user_plants", { p_user_id: user.id, p_plant_ids: plantIds }),
        supabase.rpc("set_user_departments", { p_user_id: user.id, p_department_ids: deptIds }),
      ]);
      if (p.error) throw p.error;
      if (d.error) throw d.error;
    },
    onSuccess: () => {
      toast.success("Access updated");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update access"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{user.full_name || user.email}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {user.role === "admin" && <Badge>Admin</Badge>}
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="gap-2"
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {user.role === "admin" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              This user is an <strong>admin</strong> and bypasses all plant /
              module checks. Plant & department assignments below are tracked
              for reporting but do not restrict access.
            </span>
          </div>
        )}

        <section>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Plants
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            The user will only see data for plants checked here. First plant
            selected becomes their default.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plants.map((p: any) => (
              <label
                key={p.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={selectedPlantIds.has(p.id)}
                  onCheckedChange={() => togglePlant(p.id)}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Departments
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Departments grant module access — manage which modules each
            department unlocks in the next tab.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {departments.map((d: any) => (
              <label
                key={d.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={selectedDeptIds.has(d.id)}
                  onCheckedChange={() => toggleDept(d.id)}
                />
                <div className="font-medium">{d.name}</div>
              </label>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MODULES MATRIX TAB
// ---------------------------------------------------------------------------
function ModulesMatrixTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ac-dept-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_departments_with_modules");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async ({ deptId, modules }: { deptId: string; modules: string[] }) => {
      const { error } = await supabase.rpc("set_department_modules", {
        p_department_id: deptId,
        p_modules: modules,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department updated");
      qc.invalidateQueries({ queryKey: ["ac-dept-modules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const toggle = (dept: any, modKey: string) => {
    const isAdminLike = dept.name === "Admin" || dept.name === "Management";
    if (isAdminLike) {
      toast.info(`${dept.name} always has access to every module.`);
      return;
    }
    const current = new Set<string>(dept.modules ?? []);
    current.has(modKey) ? current.delete(modKey) : current.add(modKey);
    // 'core' is always granted to anyone who has any department.
    current.add("core");
    save.mutate({ deptId: dept.department_id, modules: Array.from(current) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Which modules each department can see</CardTitle>
        <CardDescription>
          Admin and Management always see everything. Toggle a cell to grant or
          revoke that module for the department.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Department</th>
              {MODULES.map((m) => (
                <th key={m.key} className="p-2 text-center font-semibold">
                  <div>{m.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {m.hint}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d: any) => {
              const granted = new Set<string>(d.modules ?? []);
              const isAdminLike = d.name === "Admin" || d.name === "Management";
              return (
                <tr key={d.department_id} className="border-b">
                  <td className="p-2 font-medium">
                    {d.name}
                    {isAdminLike && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        full access
                      </Badge>
                    )}
                  </td>
                  {MODULES.map((m) => (
                    <td key={m.key} className="p-2 text-center">
                      <Checkbox
                        checked={isAdminLike || granted.has(m.key)}
                        disabled={isAdminLike || save.isPending}
                        onCheckedChange={() => toggle(d, m.key)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PLANTS TAB (pointer)
// ---------------------------------------------------------------------------
function PlantsTabHint() {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">
          Add and edit plants in the dedicated page.
        </p>
        <Button asChild>
          <a href="/management/plants">Go to Plants</a>
        </Button>
      </CardContent>
    </Card>
  );
}