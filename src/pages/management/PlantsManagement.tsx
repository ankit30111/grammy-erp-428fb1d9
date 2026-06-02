import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { AdminGuard } from "@/components/Auth/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlant } from "@/contexts/PlantContext";
import {
  Building2,
  Plus,
  Pencil,
  Loader2,
  MapPin,
  Phone,
  Mail,
  FileText,
} from "lucide-react";

interface PlantRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  factory_license_no: string | null;
  notes: string | null;
}

type PlantFormState = {
  code: string;
  name: string;
  is_active: boolean;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  gstin: string;
  factory_license_no: string;
  notes: string;
};

const emptyForm: PlantFormState = {
  code: "",
  name: "",
  is_active: true,
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  phone: "",
  email: "",
  gstin: "",
  factory_license_no: "",
  notes: "",
};

const toPayload = (f: PlantFormState) => ({
  code: f.code.trim(),
  name: f.name.trim(),
  is_active: f.is_active,
  address_line1: f.address_line1.trim() || null,
  address_line2: f.address_line2.trim() || null,
  city: f.city.trim() || null,
  state: f.state.trim() || null,
  postal_code: f.postal_code.trim() || null,
  country: f.country.trim() || null,
  phone: f.phone.trim() || null,
  email: f.email.trim() || null,
  gstin: f.gstin.trim() || null,
  factory_license_no: f.factory_license_no.trim() || null,
  notes: f.notes.trim() || null,
});

const fromRow = (p: PlantRow): PlantFormState => ({
  code: p.code,
  name: p.name,
  is_active: p.is_active,
  address_line1: p.address_line1 ?? "",
  address_line2: p.address_line2 ?? "",
  city: p.city ?? "",
  state: p.state ?? "",
  postal_code: p.postal_code ?? "",
  country: p.country ?? "India",
  phone: p.phone ?? "",
  email: p.email ?? "",
  gstin: p.gstin ?? "",
  factory_license_no: p.factory_license_no ?? "",
  notes: p.notes ?? "",
});

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
        .select("*")
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
    mutationFn: async (payload: ReturnType<typeof toPayload>) => {
      const { error } = await supabase.from("plants").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plant created" });
      setAddOpen(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed to create plant", description: e.message, variant: "destructive" }),
  });

  const updatePlant = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReturnType<typeof toPayload> }) => {
      // Strip immutable code on update
      const { code: _code, ...rest } = payload;
      const { error } = await supabase.from("plants").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plant updated" });
      setEditPlant(null);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed to update plant", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-7 w-7" />
              Plants / Factories
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Manage your manufacturing units. The active plant in the header
              determines which orders, GRNs and production data you see.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add plant
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading plants…
          </div>
        ) : plants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No plants yet. Click <strong>Add plant</strong> to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plants.map((p) => (
              <PlantCard key={p.id} plant={p} onEdit={() => setEditPlant(p)} />
            ))}
          </div>
        )}
      </div>

      <PlantDialog
        mode="add"
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(form) => createPlant.mutate(toPayload(form))}
        submitting={createPlant.isPending}
      />
      <PlantDialog
        mode="edit"
        open={!!editPlant}
        initial={editPlant ? fromRow(editPlant) : undefined}
        onOpenChange={(v) => !v && setEditPlant(null)}
        onSubmit={(form) =>
          editPlant && updatePlant.mutate({ id: editPlant.id, payload: toPayload(form) })
        }
        submitting={updatePlant.isPending}
      />
    </DashboardLayout>
  );
};

function PlantCard({ plant, onEdit }: { plant: PlantRow; onEdit: () => void }) {
  const addressParts = [
    plant.address_line1,
    plant.address_line2,
    [plant.city, plant.state, plant.postal_code].filter(Boolean).join(", "),
    plant.country,
  ].filter((s) => s && String(s).trim().length > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">{plant.code}</Badge>
              <Badge variant={plant.is_active ? "default" : "secondary"}>
                {plant.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <CardTitle className="text-xl">{plant.name}</CardTitle>
            <CardDescription className="text-xs">
              Created {new Date(plant.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1 shrink-0">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailBlock icon={<MapPin className="h-4 w-4" />} label="Address">
          {addressParts.length > 0 ? (
            <div className="text-sm space-y-0.5">
              {addressParts.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : (
            <EmptyHint>No address on file</EmptyHint>
          )}
        </DetailBlock>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailBlock icon={<Phone className="h-4 w-4" />} label="Phone">
            {plant.phone ? <span className="text-sm">{plant.phone}</span> : <EmptyHint>—</EmptyHint>}
          </DetailBlock>
          <DetailBlock icon={<Mail className="h-4 w-4" />} label="Email">
            {plant.email ? <span className="text-sm break-all">{plant.email}</span> : <EmptyHint>—</EmptyHint>}
          </DetailBlock>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailBlock icon={<FileText className="h-4 w-4" />} label="GSTIN">
            {plant.gstin ? (
              <span className="text-sm font-mono">{plant.gstin}</span>
            ) : (
              <EmptyHint>—</EmptyHint>
            )}
          </DetailBlock>
          <DetailBlock icon={<FileText className="h-4 w-4" />} label="Factory license">
            {plant.factory_license_no ? (
              <span className="text-sm font-mono">{plant.factory_license_no}</span>
            ) : (
              <EmptyHint>—</EmptyHint>
            )}
          </DetailBlock>
        </div>

        {plant.notes && (
          <>
            <Separator />
            <div className="text-sm whitespace-pre-wrap text-muted-foreground">{plant.notes}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground italic">{children}</span>;
}

function PlantDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  submitting,
  initial,
}: {
  mode: "add" | "edit";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (form: PlantFormState) => void;
  submitting: boolean;
  initial?: PlantFormState;
}) {
  const [form, setForm] = useState<PlantFormState>(initial ?? emptyForm);

  useEffect(() => {
    if (open) setForm(initial ?? emptyForm);
  }, [open, initial?.code]);

  const set = <K extends keyof PlantFormState>(k: K, v: PlantFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add plant" : "Edit plant"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Create a new manufacturing plant. Code is permanent — choose carefully."
              : "Update plant details. Code is locked because it is used as the historical key."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Basics */}
          <Section title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Code *">
                <Input
                  value={form.code}
                  disabled={mode === "edit"}
                  onChange={(e) =>
                    set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="e.g. GE, GA"
                  maxLength={10}
                  className="font-mono"
                />
              </Field>
              <Field label="Name *">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Grammy Electronics"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive plants won't appear in the plant switcher.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </div>
          </Section>

          {/* Address */}
          <Section title="Address">
            <Field label="Address line 1">
              <Input
                value={form.address_line1}
                onChange={(e) => set("address_line1", e.target.value)}
                placeholder="Plot 12, Industrial Area"
              />
            </Field>
            <Field label="Address line 2">
              <Input
                value={form.address_line2}
                onChange={(e) => set("address_line2", e.target.value)}
                placeholder="Phase II"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="City">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
              <Field label="Postal code">
                <Input
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Country">
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 ..."
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="plant@example.com"
                />
              </Field>
            </div>
          </Section>

          {/* Regulatory */}
          <Section title="Regulatory">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="GSTIN" hint="15-character GST identification number">
                <Input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  maxLength={15}
                  className="font-mono"
                  placeholder="22AAAAA0000A1Z5"
                />
              </Field>
              <Field label="Factory license no.">
                <Input
                  value={form.factory_license_no}
                  onChange={(e) => set("factory_license_no", e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything else worth recording about this plant…"
              rows={3}
            />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={submitting || !canSubmit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "add" ? (
              "Create plant"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PlantsManagement = () => (
  <AdminGuard>
    <PlantsManagementInner />
  </AdminGuard>
);

export default PlantsManagement;
