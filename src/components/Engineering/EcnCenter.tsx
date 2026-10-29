import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RawMaterialDropdown } from "@/components/PPC/RawMaterialDropdown";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import {
  type Ecn, type EcnType, ECN_STATUS, ECN_TYPE, OLD_STOCK_ACTIONS, useEcnMutations, useEcns, usePartImpact, useWhereUsed,
} from "@/hooks/useEcns";
import { cn } from "@/lib/utils";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const statusBadge = (s: Ecn["status"]) => <Badge variant={ECN_STATUS[s].tone as any}>{ECN_STATUS[s].label}</Badge>;
const PartChip = ({ p }: { p: { part_code: string; name: string } | null }) =>
  p ? <span className="whitespace-nowrap"><span className="font-mono font-medium">{p.part_code}</span> <span className="text-muted-foreground">{p.name}</span></span> : <span>—</span>;

/** R&D → ECNs (all of them), and Approvals → ECNs waiting for Management (onlyWaiting). */
export function EcnCenter({ queue }: { queue?: "management" | "rnd" }) {
  const onlyWaiting = !!queue;
  const { data = [], isLoading } = useEcns();
  const { canApprove } = usePermissions();
  const { canAccessModule } = useAuth() as any;
  const canEdit = canApprove || canAccessModule?.("rnd");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [raising, setRaising] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = data.filter((e) => queue === "management" ? ["SUBMITTED", "APPROVED"].includes(e.status)
    : queue === "rnd" ? e.status === "DRAFT"
    : filter === "all" || ["DRAFT", "SUBMITTED", "APPROVED"].includes(e.status));
  const open = data.find((e) => e.id === openId) ?? null;

  return (
    <Card>
      <CardContent className={onlyWaiting ? "p-0" : "space-y-4 p-4"}>
        {!onlyWaiting && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-md border p-0.5 text-sm">
              {([["open", "Open"], ["all", "All"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)}
                        className={cn("rounded px-3 py-1.5", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
              ))}
            </div>
            {canEdit && <Button onClick={() => setRaising(true)}><Plus className="h-4 w-4 mr-1" /> Replace or correct a part</Button>}
          </div>
        )}
        {!onlyWaiting && (
          <p className="text-xs text-muted-foreground">A part replacement or code correction changes every product that uses the part in one ECN. To change one product's BOM, raise an ECN on its BOM tab.</p>
        )}
        <div className={cn("overflow-x-auto", !onlyWaiting && "rounded-md border")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ECN</TableHead><TableHead>Type</TableHead><TableHead>What changes</TableHead>
                <TableHead>Part</TableHead><TableHead className="text-right">Changes</TableHead><TableHead>Status</TableHead><TableHead>Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                : !shown.length ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{onlyWaiting ? "Nothing waiting." : "No ECNs here."}</TableCell></TableRow>
                : shown.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpenId(e.id)}>
                    <TableCell className="whitespace-nowrap font-mono font-medium">{e.ecn_no}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{ECN_TYPE[e.change_type]}</TableCell>
                    <TableCell className="min-w-[14rem] text-sm">{e.title}</TableCell>
                    <TableCell className="text-sm">
                      {e.old_part ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono">{e.old_part.part_code}<ArrowRight className="h-3.5 w-3.5" />{e.new_part?.part_code}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.versions.length + e.swaps.length}</TableCell>
                    <TableCell className="whitespace-nowrap">{statusBadge(e.status)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-sm">{fmtDate(e.created_at)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {raising && <RaiseDialog onClose={() => setRaising(false)} onDone={(id) => { setRaising(false); setOpenId(id); }} />}
      {open && <EcnDialog ecn={open} canEdit={!!canEdit} canApprove={canApprove} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

/* ─────────────────────────────── raise ─────────────────────────────── */

function RaiseDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { rawMaterials } = useRawMaterials();
  const m = useEcnMutations();
  const [type, setType] = useState<EcnType>("REPLACEMENT");
  const [oldId, setOldId] = useState("");
  const [makeNew, setMakeNew] = useState(true);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [qty, setQty] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const { data: used = [], isFetching } = useWhereUsed(oldId || null);
  const { data: impact } = usePartImpact(oldId || null);
  const oldPart: any = rawMaterials.find((p: any) => p.id === oldId);
  const newPart: any = rawMaterials.find((p: any) => p.id === newId);
  const creating = type === "REPLACEMENT" && makeNew;

  useEffect(() => { setTicked(new Set(used.filter((u) => !u.busy_in).map((u) => u.item_id))); }, [used]);
  useEffect(() => { if (oldPart && !newName) setNewName(oldPart.name); }, [oldPart]); // eslint-disable-line
  const target = creating ? (newName ? "a new code" : "") : newPart?.part_code;
  const autoTitle = oldPart && target ? `${oldPart.part_code} → ${target}` : "";
  const uomDiffers = !creating && oldPart && newPart && (oldPart.uom ?? "") !== (newPart.uom ?? "");

  const versions = used.filter((u) => u.kind === "VERSION"), production = used.filter((u) => u.kind === "PRODUCTION");
  const tick = (id: string, on: boolean) => setTicked((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const ready = oldId && (creating ? newName.trim() : newId) && ticked.size > 0 && (!uomDiffers || Number(qty) > 0);

  const submit = () => m.raise.mutate({
    type, title: title.trim() || autoTitle, reason, old: oldId, newPart: creating ? null : newId, newName: creating ? newName.trim() : null,
    items: versions.filter((u) => ticked.has(u.item_id)).map((u) => u.item_id),
    production: production.filter((u) => ticked.has(u.item_id)).map((u) => u.item_id),
    qty: Number(qty) > 0 ? Number(qty) : null,
  }, { onSuccess: (id) => onDone(id) });

  const UsedTable = ({ rows, title: t, note }: { rows: typeof used; title: string; note: string }) => !rows.length ? null : (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Product / sub-assembly</TableHead><TableHead>Version</TableHead><TableHead>Uses</TableHead><TableHead>Brand codes rebuilt</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.item_id} className={cn(u.busy_in && "opacity-60")}>
                <TableCell><Checkbox disabled={!!u.busy_in} checked={ticked.has(u.item_id)} onCheckedChange={(v) => tick(u.item_id, !!v)} aria-label={`Change ${u.part_code}`} /></TableCell>
                <TableCell className="text-sm"><PartChip p={u} />{u.busy_in && <div className="text-xs text-destructive">Already being changed in {u.busy_in}</div>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{u.version ? `v${u.version}` : "—"}</TableCell>
                <TableCell className="text-sm">{u.usage}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.brand_codes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,1000px)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replace or correct a part</DialogTitle>
          <DialogDescription>One ECN changes every product you tick. R&D sends it; Management approves and releases it.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {([["REPLACEMENT", "Part replacement", "The part has changed (size, value, material, spec): a new part code takes its place. The old code is phased out."],
             ["CORRECTION", "Code correction", "The wrong code was entered; nothing physical changes. The wrong code is closed."]] as const).map(([k, l, d]) => (
            <button key={k} type="button" onClick={() => setType(k)}
                    className={cn("rounded-md border p-3 text-left", type === k ? "border-primary ring-1 ring-primary" : "hover:bg-muted")}>
              <div className="text-sm font-medium">{l}</div><div className="text-xs text-muted-foreground">{d}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 min-w-0">
            <Label>{type === "CORRECTION" ? "Wrong part" : "Old part"}</Label>
            <RawMaterialDropdown value={oldId} onValueChange={(v) => { setOldId(v); setNewName(""); }} placeholder="Choose the part" />
          </div>
          <div className="space-y-1 min-w-0">
            <Label>{type === "CORRECTION" ? "Correct part" : "New part"}</Label>
            {type === "REPLACEMENT" && (
              <div className="flex rounded-md border p-0.5 text-xs">
                {([[true, "Make a new code"], [false, "Use an existing code"]] as const).map(([v, l]) => (
                  <button key={String(v)} type="button" onClick={() => setMakeNew(v)}
                          className={cn("flex-1 rounded px-2 py-1", makeNew === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
                ))}
              </div>
            )}
            {creating
              ? <Input placeholder="Name of the new part" value={newName} onChange={(e) => setNewName(e.target.value)} />
              : <RawMaterialDropdown value={newId} onValueChange={setNewId} excludeIds={oldId ? [oldId] : []} placeholder="Choose the part" />}
            {creating && oldPart && <p className="text-xs text-muted-foreground">Next {oldPart.category} code; same unit and vendors as {oldPart.part_code}. Upload its spec sheet on the Parts page.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ecn-qty">Quantity in each product</Label>
            <Input id="ecn-qty" type="number" min="0" step="any" placeholder={uomDiffers ? `Required: ${oldPart?.uom} → ${newPart?.uom}` : "Same as now"} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ecn-title">What changes</Label>
            <Input id="ecn-title" placeholder={autoTitle || "e.g. Holding tape D-074 → tape D-038"} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ecn-why">Why</Label>
            <Textarea id="ecn-why" rows={2} placeholder={type === "CORRECTION" ? "e.g. Wrong part code entered at BOM creation" : "e.g. Supplier changed the tape to a 0.15 mm backing"} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        {oldId && (
          <div className="space-y-4">
            {isFetching ? <p className="text-sm text-muted-foreground">Finding where {oldPart?.part_code} is used…</p>
              : !used.length ? <p className="text-sm text-destructive">{oldPart?.part_code} is not used in any released product or production BOM.</p>
              : <>
                  <UsedTable rows={versions} title={`Where ${oldPart?.part_code} is used`} note="Each ticked item gets a new version in this ECN; products that use a changed sub-assembly follow. Brand codes are rebuilt on release." />
                  <UsedTable rows={production} title="Production BOMs without an R&D version" note="The part is swapped directly in these BOMs on release." />
                </>}
            {impact && <ImpactPanel impact={impact} code={oldPart?.part_code} />}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready || m.raise.isPending} onClick={submit}>{m.raise.isPending ? "Raising…" : `Raise ECN · ${ticked.size} item${ticked.size === 1 ? "" : "s"}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImpactPanel({ impact, code }: { impact: NonNullable<ReturnType<typeof usePartImpact>["data"]>; code?: string }) {
  const total = impact.stock.reduce((s, r) => s + Number(r.quantity), 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{code} in stock</div>
        {!impact.stock.length ? <span className="text-muted-foreground">None</span> : impact.stock.map((s) => (
          <div key={s.code} className="flex justify-between"><span>{s.location}</span><span className="tabular-nums">{Number(s.quantity).toLocaleString("en-IN")} {impact.uom}</span></div>
        ))}
        {impact.stock.length > 1 && <div className="mt-1 flex justify-between border-t pt-1 font-medium"><span>Total</span><span className="tabular-nums">{total.toLocaleString("en-IN")} {impact.uom}</span></div>}
      </div>
      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open purchase orders</div>
        {!impact.open_pos.length ? <span className="text-muted-foreground">None</span> : impact.open_pos.map((p) => (
          <div key={p.po_number} className="flex justify-between gap-2"><span className="font-mono">{p.po_number}</span>
            <span className="tabular-nums">{Number(p.received).toLocaleString("en-IN")} / {Number(p.ordered).toLocaleString("en-IN")} received</span></div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── one ECN ─────────────────────────────── */

function EcnDialog({ ecn: e, canEdit, canApprove, onClose }: { ecn: Ecn; canEdit: boolean; canApprove: boolean; onClose: () => void }) {
  const m = useEcnMutations();
  const { data: impact } = usePartImpact(e.old_part?.id ?? null);
  const open = e.status === "DRAFT" || e.status === "SUBMITTED";
  const [useOld, setUseOld] = useState(e.use_old_stock);
  const [from, setFrom] = useState(e.effective_from ?? "");
  const [action, setAction] = useState(e.old_stock_action ?? "");
  const [note, setNote] = useState(e.old_stock_note ?? "");
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => { setUseOld(e.use_old_stock); setFrom(e.effective_from ?? ""); setAction(e.old_stock_action ?? ""); setNote(e.old_stock_note ?? ""); }, [e]);
  const dirty = useOld !== e.use_old_stock || (from || null) !== (e.effective_from ?? null) || (action || null) !== (e.old_stock_action ?? null) || (note || "") !== (e.old_stock_note ?? "");
  const productOf = (v: Ecn["versions"][number]) => v.item.source_type === "MODEL" ? `/rnd/products/${encodeURIComponent(v.item.part_code)}?tab=bom` : null;
  const partChange = e.change_type !== "BOM_CHANGE";
  const busy = m.approve.isPending || m.submit.isPending || m.cancel.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,980px)] max-w-none overflow-y-auto">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="font-mono text-xl">{e.ecn_no}</DialogTitle>
            <Badge variant="outline">{ECN_TYPE[e.change_type]}</Badge>
            {statusBadge(e.status)}
          </div>
          <DialogDescription className="text-foreground">{e.title}{e.reason && <span className="text-muted-foreground"> · {e.reason}</span>}</DialogDescription>
        </DialogHeader>

        {e.returned_note && e.status === "DRAFT" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <span className="font-medium">Sent back by Management {fmtDate(e.returned_at)}:</span> {e.returned_note}
          </div>
        )}

        {partChange && (
          <div className="grid items-center gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="text-sm"><div className="text-xs text-muted-foreground">{e.change_type === "CORRECTION" ? "Wrong part" : "Old part"}</div><PartChip p={e.old_part} />
              {e.old_part?.lifecycle && e.old_part.lifecycle !== "ACTIVE" && <Badge variant="secondary" className="ml-2">{e.old_part.lifecycle === "OBSOLETE" ? "obsolete" : "phasing out"}</Badge>}</div>
            <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
            <div className="text-sm"><div className="text-xs text-muted-foreground">{e.change_type === "CORRECTION" ? "Correct part" : "New part"}{e.new_part_created ? " · new code" : ""}</div><PartChip p={e.new_part} />
              <div className="text-xs text-muted-foreground">Quantity: {e.new_quantity != null ? `${e.new_quantity} ${e.new_part?.uom ?? ""}` : "same as before"}</div></div>
          </div>
        )}

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it changes</h3>
          <div className="divide-y rounded-md border text-sm">
            {e.versions.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <PartChip p={v.item} />
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-muted-foreground">v{v.version} {v.status === "DRAFT" ? "draft" : "released"}</span>
                  {productOf(v) && <Link className="text-xs underline-offset-2 hover:underline" to={productOf(v)!}>Open BOM</Link>}
                </span>
              </div>
            ))}
            {e.swaps.map((s) => (
              <div key={s.parent.part_code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <PartChip p={s.parent} /><span className="text-muted-foreground">production BOM</span>
              </div>
            ))}
            {!e.versions.length && !e.swaps.length && <div className="px-3 py-2 text-muted-foreground">Nothing yet.</div>}
          </div>
        </section>

        {partChange && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Old stock</h3>
            {impact && <ImpactPanel impact={impact} code={e.old_part?.part_code} />}
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>{useOld ? <>Production keeps using {e.old_part?.part_code} until <b>{fmtDate(from) || "the date below"}</b>, then switches to {e.new_part?.part_code}.</>
                : <>From release, <b>all production uses {e.new_part?.part_code}</b>. {e.old_part?.part_code} can no longer be ordered.</>}</p>
              {open && canEdit ? (
                <div className="grid gap-2 sm:grid-cols-[auto_10rem_minmax(0,1fr)] sm:items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={useOld} onCheckedChange={(v) => setUseOld(!!v)} /> Confirmed: use up the old stock first, switch on
                  </label>
                  <Input type="date" disabled={!useOld} min={todayIst()} value={from} onChange={(ev) => setFrom(ev.target.value)} />
                  <span />
                  <span className="text-muted-foreground">What happens to old stock</span>
                  <select className={sel} value={action} onChange={(ev) => setAction(ev.target.value)}>
                    <option value="">Not decided</option>
                    {OLD_STOCK_ACTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <Input placeholder="Note (optional)" value={note} onChange={(ev) => setNote(ev.target.value)} />
                  {dirty && <div className="sm:col-span-3 flex justify-end">
                    <Button size="sm" variant="outline" disabled={useOld && !from}
                            onClick={() => m.setOldStock.mutate({ id: e.id, useOld, from: useOld ? from : null, action: action || null, note })}>Save</Button>
                  </div>}
                </div>
              ) : (
                <p className="text-muted-foreground">Old stock: {OLD_STOCK_ACTIONS.find(([k]) => k === e.old_stock_action)?.[1] ?? "not decided"}{e.old_stock_note ? ` · ${e.old_stock_note}` : ""}</p>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Raised {fmtDate(e.created_at)}{e.submitted_at ? ` · sent ${fmtDate(e.submitted_at)}` : ""}{e.approved_at ? ` · approved ${fmtDate(e.approved_at)}` : ""}{e.released_at ? ` · released ${fmtDate(e.released_at)}` : ""}</span>
          <div className="flex flex-wrap gap-2">
            {open && canEdit && <Button variant="ghost" size="sm" disabled={busy}
              onClick={() => window.confirm(`Cancel ${e.ecn_no}? Its drafts are discarded${e.new_part_created ? ` and ${e.new_part?.part_code} is deleted` : ""}.`) && m.cancel.mutate(e.id, { onSuccess: onClose })}>Cancel ECN</Button>}
            {e.status === "DRAFT" && canEdit && <Button size="sm" variant={canApprove ? "outline" : "default"} disabled={busy || dirty} onClick={() => m.submit.mutate(e.id)}>Send to Management</Button>}
            {open && canApprove && e.status === "SUBMITTED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setBack("")}>Send back</Button>}
            {open && canApprove && <Button size="sm" disabled={busy || dirty}
              onClick={() => window.confirm(e.use_old_stock && e.effective_from && e.effective_from > todayIst()
                ? `Approve ${e.ecn_no}? It goes live on ${fmtDate(e.effective_from)}.`
                : `Approve and release ${e.ecn_no}? From now on all production uses the new BOMs.`) && m.approve.mutate(e.id)}>
              {e.use_old_stock && e.effective_from && e.effective_from > todayIst() ? `Approve · live ${fmtDate(e.effective_from)}` : "Approve & release"}</Button>}
          </div>
        </div>
        {back !== null && (
          <form className="flex flex-wrap gap-2" onSubmit={(ev) => { ev.preventDefault(); m.sendBack.mutate({ id: e.id, note: back }, { onSuccess: () => setBack(null) }); }}>
            <Input autoFocus className="flex-1" placeholder="What R&D needs to change" value={back} onChange={(ev) => setBack(ev.target.value)} />
            <Button type="submit" size="sm" disabled={!back.trim()}>Send back</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBack(null)}>Cancel</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
