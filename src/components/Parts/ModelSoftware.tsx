import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cpu, Download, Paperclip, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

/**
 * The software of a model (MCU firmware, DSP, BT module, app ...) and each one's
 * versions. It is kept on the model, so every brand code shows the same list.
 * R&D, Management and Admin add software and versions and edit the details.
 */

const db = supabase as any;
const BUCKET = "raw-material-documents";

interface Version {
  id: string; software_id: string; version: string; released_on: string; details: string | null; file_path: string | null;
  created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null;
}
interface Software { id: string; name: string; notes: string | null; versions: Version[] }

const fmt = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
/** 1.10 after 1.9; newest release first. */
const newestFirst = (a: Version, b: Version) =>
  b.released_on.localeCompare(a.released_on) || b.version.localeCompare(a.version, "en", { numeric: true }) || b.created_at.localeCompare(a.created_at);

function useModelSoftware(modelId?: string | null) {
  return useQuery({
    queryKey: ["model-software", modelId],
    enabled: !!modelId,
    queryFn: async (): Promise<Software[]> => {
      const [sw, vers] = await Promise.all([
        db.from("model_software").select("id, name, notes").eq("model_id", modelId).order("name"),
        db.from("model_software_history").select("*").eq("model_id", modelId),
      ]);
      if (sw.error) throw sw.error;
      if (vers.error) throw vers.error;
      return (sw.data ?? []).map((s: any) => ({
        ...s, versions: (vers.data ?? []).filter((v: Version) => v.software_id === s.id).sort(newestFirst),
      }));
    },
  });
}

async function downloadFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return toast.error("Could not download the file");
  const url = URL.createObjectURL(data);
  Object.assign(document.createElement("a"), { href: url, download: path.split("/").pop()!.replace(/^\d+_/, "") }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ModelSoftwarePanel({ modelId, modelCode }: { modelId?: string | null; modelCode: string }) {
  const { canEditMasters } = usePermissions();
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useModelSoftware(modelId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const addSoftware = useMutation({
    mutationFn: async (n: string) => {
      const { data, error } = await db.from("model_software").insert({ model_id: modelId, name: n.trim() }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["model-software", modelId] });
      setAdding(false); setName(""); setOpenId(id);
    },
    onError: (e: any) => toast.error(e?.code === "23505" ? "This model already has software with that name" : e.message),
  });

  if (!modelId) return null;
  const current = list.find((s) => s.id === openId);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">Software</span>
        {canEditMasters && !adding && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </div>
      {adding && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) addSoftware.mutate(name); }}>
          <Input autoFocus className="h-9" placeholder="MCU firmware, DSP, BT module…" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" disabled={!name.trim() || addSoftware.isPending}>Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
        </form>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : !list.length ? !adding && <p className="text-sm text-muted-foreground">No software recorded for {modelCode}.</p>
        : (
          <div className="flex flex-col gap-1.5">
            {list.map((s) => {
              const latest = s.versions[0];
              return (
                <button key={s.id} type="button" onClick={() => setOpenId(s.id)}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                  <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{s.name}</span>
                    <span className={cn("block text-xs", latest ? "text-muted-foreground" : "text-destructive")}>
                      {latest ? `v${latest.version} · ${fmt(latest.released_on)}` : "no version yet"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      {current && (
        <SoftwareHistoryDialog software={current} modelId={modelId} modelCode={modelCode} canEdit={canEditMasters}
                               onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function SoftwareHistoryDialog({ software: s, modelId, modelCode, canEdit, onClose }: {
  software: Software; modelId: string; modelCode: string; canEdit: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["model-software", modelId] });
  const [f, setF] = useState({ version: "", released_on: today(), details: "" });
  const [file, setFile] = useState<File | null>(null);

  const addVersion = useMutation({
    mutationFn: async () => {
      let file_path: string | null = null;
      if (file) {
        file_path = `software/${modelCode}/${s.name.replace(/[^\w.-]+/g, "_")}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
        const up = await supabase.storage.from(BUCKET).upload(file_path, file);
        if (up.error) throw up.error;
      }
      const { error } = await db.from("model_software_versions").insert({
        software_id: s.id, version: f.version.trim().replace(/^v(?=\d)/i, ""), released_on: f.released_on || today(),
        details: f.details.trim() || null, file_path,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setF({ version: "", released_on: today(), details: "" }); setFile(null); toast.success("Version added"); },
    onError: (e: any) => toast.error(e?.code === "23505" ? `Version ${f.version} is already there` : e.message),
  });

  const saveDetails = useMutation({
    mutationFn: async ({ id, details }: { id: string; details: string }) => {
      const { error } = await db.from("model_software_versions").update({ details: details.trim() || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const attach = useMutation({
    mutationFn: async ({ v, file }: { v: Version; file: File }) => {
      const path = `software/${modelCode}/${s.name.replace(/[^\w.-]+/g, "_")}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file);
      if (up.error) throw up.error;
      const { error } = await db.from("model_software_versions").update({ file_path: path }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[min(94vw,1000px)] max-w-none flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{modelCode} · {s.name}</DialogTitle>
          <DialogDescription>
            {s.versions.length ? `${s.versions.length} version${s.versions.length === 1 ? "" : "s"}, newest first.` : "No version yet."} Press Esc to go back.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <form className="grid gap-2 rounded-md border p-3 sm:grid-cols-[8rem_10rem_minmax(0,1fr)_auto_auto] sm:items-end"
                onSubmit={(e) => { e.preventDefault(); if (f.version.trim()) addVersion.mutate(); }}>
            <label className="space-y-1 text-xs text-muted-foreground">New version
              <Input className="h-9" placeholder="1.2.0" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">Released
              <Input className="h-9" type="date" value={f.released_on} onChange={(e) => setF({ ...f, released_on: e.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">What changed
              <Input className="h-9" placeholder="Bass boost curve, BT name, fixes…" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
            </label>
            <label className={cn("inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border px-2 text-sm", file ? "text-foreground" : "text-muted-foreground")}
                   title={file?.name}>
              <Paperclip className="h-4 w-4" /> <span className="max-w-[8rem] truncate">{file ? file.name : "File"}</span>
              <input type="file" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <Button type="submit" disabled={!f.version.trim() || addVersion.isPending}>{addVersion.isPending ? "Saving…" : "Add version"}</Button>
          </form>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-24">Version</TableHead>
                <TableHead className="w-28">Released</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-28">File</TableHead>
                <TableHead className="w-40">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!s.versions.length && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No version recorded yet.</TableCell></TableRow>
              )}
              {s.versions.map((v, i) => (
                <TableRow key={v.id} className="align-top">
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    v{v.version}{i === 0 && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-sans text-xs text-primary">latest</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmt(v.released_on)}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Textarea key={`${v.id}${v.updated_at}`} rows={2} className="min-h-[2.5rem] text-sm" defaultValue={v.details ?? ""} placeholder="Short note on this version"
                                onBlur={(e) => e.target.value.trim() !== (v.details ?? "") && saveDetails.mutate({ id: v.id, details: e.target.value })} />
                    ) : <p className="whitespace-pre-wrap text-sm">{v.details || <span className="text-muted-foreground">—</span>}</p>}
                  </TableCell>
                  <TableCell>
                    {v.file_path ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => downloadFile(v.file_path!)}>
                        <Download className="h-4 w-4" /> File
                      </Button>
                    ) : canEdit ? (
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted">
                        <Paperclip className="h-4 w-4" /> Attach
                        <input type="file" className="sr-only" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) attach.mutate({ v, file: fl }); }} />
                      </label>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.created_by_name ?? "—"}
                    {v.updated_by_name && v.updated_at.slice(0, 16) !== v.created_at.slice(0, 16) && (
                      <div>edited by {v.updated_by_name} {fmt(v.updated_at)}</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
