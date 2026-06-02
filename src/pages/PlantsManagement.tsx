import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { AdminGuard } from "@/components/Auth/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlant } from "@/contexts/PlantContext";
import { Building2, Plus, Pencil, Loader2 } from "lucide-react";

interface PlantRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const PlantsManagementInner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { refresh: refreshPlants } = usePlant();

  const [addOpen, setAddOpen] = useState(false);
  const [editPlant, setEditPlant] = useState<PlantRow | null>(null);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plants")
        .select("id, code, name, is_active, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlantRow[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["plants-management"] });
    refreshPlants();
  };

  const createPlant = useMutation({
    mutationFn: async (payload: { code: string; name: string; is_active: boolean }) => {
      const { error } = await supabase.from("plants").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plant created" });
      setAddOpen(false);
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Failed to create plant", description: e.message, variant: "destructive" });
    },
  });

  const updatePlant = useMutation({
    mutationFn: async ({ id, name, is_active }: { id: string; name: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("plants")
        .update({ name, is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plant updated" });
      setEditPlant(null);
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Failed to update plant", description: e.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-7 w-7" />
              Plants
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage manufacturing plants. The active plant determines which orders, GRNs and production data you see.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add plant
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All plants</CardTitle>
            <CardDescription>
              Codes are immutable once created — they are used as the stable key across the database. Deactivate a plant to hide it from the switcher without losing historical data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading plants…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-medium">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditPlant(p)}
                          className="gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AddPlantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(p) => createPlant.mutate(p)}
        submitting={createPlant.isPending}
      />
      <EditPlantDialog
        plant={editPlant}
        onClose={() => setEditPlant(null)}
        onSubmit={(payload) => updatePlant.mutate(payload)}
        submitting={updatePlant.isPending}
      />
    </DashboardLayout>
  );
};

function AddPlantDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (p: { code: string; name: string; is_active: boolean }) => void;
  submitting: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setCode("");
    setName("");
    setIsActive(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add plant</DialogTitle>
          <DialogDescription>
            Add a new manufacturing plant. The code cannot be changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="e.g. GE, GA, GC"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Short uppercase identifier (letters/numbers only).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grammy Electronics"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive plants won't appear in the plant switcher.
              </p>
            </div>
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ code, name, is_active: isActive })}
            disabled={submitting || !code.trim() || !name.trim()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create plant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPlantDialog({
  plant,
  onClose,
  onSubmit,
  submitting,
}: {
  plant: PlantRow | null;
  onClose: () => void;
  onSubmit: (p: { id: string; name: string; is_active: boolean }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(plant?.name ?? "");
  const [isActive, setIsActive] = useState(plant?.is_active ?? true);

  useEffect(() => {
    if (plant) {
      setName(plant.name);
      setIsActive(plant.is_active);
    }
  }, [plant?.id]);

  return (
    <Dialog
      open={!!plant}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setName("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit plant</DialogTitle>
          <DialogDescription>
            Update plant name or active status. Code is locked because it's used as the historical key.
          </DialogDescription>
        </DialogHeader>
        {plant && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={plant.code} disabled className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="edit-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Deactivate instead of deleting — historical orders reference this plant.
                </p>
              </div>
              <Switch id="edit-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              plant && onSubmit({ id: plant.id, name, is_active: isActive })
            }
            disabled={submitting || !name.trim()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PlantsManagement = () => (
  <AdminGuard>
    <PlantsManagementInner />
  </AdminGuard>
);

export default PlantsManagement;