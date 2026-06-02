import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { AdminGuard } from "@/components/Auth/AdminGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Factory, Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { usePlant } from "@/contexts/PlantContext";

type LineType = "line" | "sub_assembly" | "cell";

interface Row {
  id: string;
  plant_id: string;
  code: string;
  name: string;
  line_type: LineType;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

interface FormState {
  code: string;
  name: string;
  line_type: LineType;
  is_active: boolean;
  sort_order: number;
  notes: string;
}

const emptyForm: FormState = {
  code: "",
  name: "",
  line_type: "line",
  is_active: true,
  sort_order: 0,
  notes: "",
};

const TYPE_LABEL: Record<LineType, string> = {
  line: "Line",
  sub_assembly: "Sub-Assembly",
  cell: "Cell",
};

export default function ProductionLinesManagement() {
  return (
    <AdminGuard requireModule="production" moduleArea="Production Lines">
      <DashboardLayout>
        <Inner />
      </DashboardLayout>
    </AdminGuard>
  );
}

function Inner() {
  const qc = useQueryClient();
  const { plants, activePlant } = usePlant();
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);

  const plantId = activePlant?.id;

  const { data: rows = [], isLoading } = useQuery({
    enabled: !!plantId,
    queryKey: ["production-lines", plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_lines")
        .select("*")
        .eq("plant_id", plantId!)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["production-lines", plantId] });

  const create = useMutation({
    mutationFn: async (form: FormState) => {
      if (!plantId) throw new Error("Pick a plant first");
      const { error } = await supabase.from("production_lines").insert({
        plant_id: plantId,
        code: form.code.trim(),
        name: form.name.trim(),
        line_type: form.line_type,
        is_active: form.is_active,
        sort_order: form.sort_order,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added");
      setAddOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const update = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: FormState }) => {
      const { error } = await supabase
        .from("production_lines")
        .update({
          name: form.name.trim(),
          line_type: form.line_type,
          is_active: form.is_active,
          sort_order: form.sort_order,
          notes: form.notes.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      setEdit(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="h-7 w-7" />
            Production Lines & Sub-Assemblies
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Manage the production-floor structure for{" "}
            <strong>{activePlant?.name ?? "your active plant"}</strong>. Add
            lines, sub-assemblies, or cells. Switch plants from the header.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" disabled={!plantId}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {!plantId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No plant selected. Choose one from the header switcher.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lines yet for this plant.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Card key={r.id} className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{r.code}</Badge>
                      <Badge variant="secondary">{TYPE_LABEL[r.line_type]}</Badge>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{r.name}</CardTitle>
                    {r.notes && (
                      <CardDescription className="text-xs whitespace-pre-wrap">
                        {r.notes}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex justify-end gap-2 pt-0">
                <Button variant="outline" size="sm" onClick={() => setEdit(r)} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${r.name}"? This cannot be undone.`)) {
                      remove.mutate(r.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LineDialog
        mode="add"
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(f) => create.mutate(f)}
        submitting={create.isPending}
      />
      <LineDialog
        mode="edit"
        open={!!edit}
        initial={
          edit
            ? {
                code: edit.code,
                name: edit.name,
                line_type: edit.line_type,
                is_active: edit.is_active,
                sort_order: edit.sort_order,
                notes: edit.notes ?? "",
              }
            : undefined
        }
        onOpenChange={(v) => !v && setEdit(null)}
        onSubmit={(f) => edit && update.mutate({ id: edit.id, form: f })}
        submitting={update.isPending}
      />
    </div>
  );
}

function LineDialog({
  mode, open, onOpenChange, onSubmit, submitting, initial,
}: {
  mode: "add" | "edit";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (form: FormState) => void;
  submitting: boolean;
  initial?: FormState;
}) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm);

  useEffect(() => {
    if (open) setForm(initial ?? emptyForm);
  }, [open, initial?.code]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add line / sub-assembly" : "Edit"}</DialogTitle>
          <DialogDescription>
            Cells, sub-assemblies, or full assembly lines on the production floor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={form.code}
                disabled={mode === "edit"}
                onChange={(e) =>
                  set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                }
                placeholder="L1, SA-AMP"
                className="font-mono"
                maxLength={20}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={form.line_type}
                onValueChange={(v) => set("line_type", v as LineType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="sub_assembly">Sub-Assembly</SelectItem>
                  <SelectItem value="cell">Cell</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Assembly Line 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => set("sort_order", parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label className="m-0">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Optional details about this line / station"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={!canSubmit || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}