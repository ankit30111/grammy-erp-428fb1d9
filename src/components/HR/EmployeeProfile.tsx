import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Edit, ImageOff, Maximize2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { PHOTO_BUCKET } from "@/lib/employeeIdCard";
import { cn } from "@/lib/utils";

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const join = (...v: (string | null | undefined)[]) => v.filter(Boolean).join(", ");
export const employeeName = (e: any) => [e.first_name, e.last_name].filter(Boolean).join(" ");

export async function loadSensitive(id: string) {
  const { data, error } = await (supabase as any).rpc("get_employee_sensitive", { p_employee_id: id });
  return { ok: !error, sensitive: (Array.isArray(data) ? data[0] : data) ?? {} };
}

/** An employee's photo in ID-card proportion (3:4), or a placeholder. */
export function EmployeePhoto({ path, className, onClick }: { path?: string | null; className?: string; onClick?: () => void }) {
  const { data: url } = useSignedStorageUrl(PHOTO_BUCKET, path ?? null);
  const box = cn("aspect-[3/4] shrink-0 overflow-hidden rounded-md border bg-muted", className);
  if (!url) {
    return <div className={cn(box, "flex items-center justify-center border-dashed text-muted-foreground")}><ImageOff className="h-1/3 max-h-6 w-auto" /></div>;
  }
  const img = <img src={url} alt="Employee photo" className="h-full w-full object-cover" />;
  return onClick ? <button type="button" onClick={onClick} className={box} aria-label="Open photo">{img}</button> : <div className={box}>{img}</div>;
}

/* ─────────── on-screen ID card (same layout as the printed one) ─────────── */

const MM = 3.1; // px per mm on screen
const mm = (v: number) => `${v * MM}px`;

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[6px] bg-white text-[#1f292e] shadow-sm ring-1 ring-black/10"
         style={{ width: mm(54), height: mm(86), fontFamily: "Helvetica, Arial, sans-serif" }}>
      {children}
    </div>
  );
}

export function IdCardPreview({ e }: { e: any }) {
  const { data: url } = useSignedStorageUrl(PHOTO_BUCKET, e.photo_path ?? null);
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <CardShell>
        <div className="flex flex-col items-center justify-center bg-[#235D63] text-white" style={{ height: mm(17) }}>
          <div className="font-bold leading-none" style={{ fontSize: mm(6) }}>GRAMMY</div>
          <div className="mt-1 tracking-[0.35em]" style={{ fontSize: mm(2) }}>ACOUSTICS</div>
        </div>
        <div className="mx-auto overflow-hidden border-2 border-[#235D63] bg-[#D6E9EB]" style={{ marginTop: mm(4), width: mm(26), height: mm(32) }}>
          {url ? <img src={url} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-[9px] text-[#6e787c]">PHOTO</div>}
        </div>
        <div className="px-2 text-center" style={{ marginTop: mm(3) }}>
          <div className="truncate font-bold uppercase leading-tight" style={{ fontSize: mm(3.4) }}>{employeeName(e)}</div>
          <div className="truncate" style={{ fontSize: mm(2.5), marginTop: mm(0.8) }}>{e.position}</div>
          <div className="truncate font-bold uppercase text-[#235D63]" style={{ fontSize: mm(2.2) }}>{e.department}</div>
        </div>
        <div className="mx-auto rounded bg-[#D6E9EB] text-center font-bold text-[#235D63]"
             style={{ width: mm(34), marginTop: mm(1.6), fontSize: mm(2.9), lineHeight: mm(6.4) }}>ID&nbsp;&nbsp;{e.employee_code}</div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-[#235D63] font-bold tracking-[0.2em] text-white"
             style={{ height: mm(5), fontSize: mm(1.8) }}>EMPLOYEE IDENTITY CARD</div>
      </CardShell>

      <CardShell>
        <div className="flex items-center justify-center bg-[#235D63] font-bold text-white" style={{ height: mm(6.5), fontSize: mm(2.2) }}>GRAMMY ACOUSTICS</div>
        <div className="space-y-[5px] px-3 pt-2">
          {[["Employee ID", e.employee_code], ["Date of joining", fmtDate(e.hire_date)],
            ["Emergency contact", [e.emergency_contact_name, e.emergency_contact_phone].filter(Boolean).join(" · ")],
            ["Address", join(e.address, e.city, e.state, e.pincode)]].map(([l, v]) => (
            <div key={l}>
              <div className="uppercase text-[#6e787c]" style={{ fontSize: mm(1.75) }}>{l}</div>
              <div className="line-clamp-3 font-bold leading-tight" style={{ fontSize: mm(2.3) }}>{v || "—"}</div>
            </div>
          ))}
          <div className="border-t border-[#D6E9EB] pt-1" style={{ fontSize: mm(1.9) }}>
            <div className="text-[#6e787c]">If found, please return to:</div>
            <div className="font-bold">Grammy Acoustics</div>
            <div className="leading-tight">Plot No. 26, HSIIDC Industrial Estate, Murthal, Sonipat, Haryana</div>
          </div>
        </div>
        <div className="absolute right-3 text-center text-[#6e787c]" style={{ bottom: mm(6.6), fontSize: mm(1.7) }}>
          <div className="mb-0.5 border-t border-[#1f292e]" style={{ width: mm(20) }} />Authorised signatory
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-[#235D63] text-white" style={{ height: mm(5), fontSize: mm(1.7) }}>
          Company property · return on leaving
        </div>
      </CardShell>
    </div>
  );
}

/* ─────────────────────────────── profile ─────────────────────────────── */

function Section({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="divide-y rounded-md border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EmployeeProfile({ employee: e, onClose, onEdit, onCard, printing }: {
  employee: any; onClose: () => void; onEdit: () => void; onCard: (layout: "card" | "a4") => void; printing?: boolean;
}) {
  const { data } = useQuery({ queryKey: ["employee-sensitive", e.id], queryFn: () => loadSensitive(e.id) });
  const s = data?.sensitive ?? {};
  const [big, setBig] = useState(false);
  const active = e.status === "active";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,1180px)] max-w-none overflow-y-auto p-6">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <DialogTitle className="font-mono text-xl">{e.employee_code}</DialogTitle>
              <span className="truncate text-lg">{employeeName(e)}</span>
              <Badge variant={active ? "default" : "secondary"}>{e.status?.replace("_", " ")}</Badge>
            </div>
            <Button size="sm" onClick={onEdit}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
          </div>
          <DialogDescription>{[e.position, e.department].filter(Boolean).join(" · ") || "—"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* left: details */}
          <div className="space-y-5">
            <Section title="Work" rows={[
              ["Joining date", fmtDate(e.hire_date)],
              ["Leaving date", e.leaving_date ? `${fmtDate(e.leaving_date)}${e.leaving_reason ? ` · ${e.leaving_reason}` : ""}` : null],
            ]} />
            <Section title="Contact" rows={[
              ["Phone", s.phone_number], ["Email", e.email], ["Date of birth", fmtDate(s.date_of_birth)],
              ["Emergency contact", [e.emergency_contact_name, e.emergency_contact_phone].filter(Boolean).join(" · ")],
            ]} />
            <Section title="Address" rows={[
              ["Current", join(e.address, e.city, e.state, e.pincode)],
              ["Permanent", join(e.permanent_address, e.permanent_city, e.permanent_state, e.permanent_pincode)],
            ]} />
            <Section title="Government IDs" rows={[["Aadhaar", s.aadhar_number], ["PAN", s.pan_number], ["ESIC", s.esic_number]]} />
            <Section title="Bank and pay" rows={[
              ["Bank", s.bank_name], ["Account number", s.bank_account_number], ["IFSC", s.ifsc_code],
              ["Salary", s.salary != null ? `₹${Number(s.salary).toLocaleString("en-IN")}` : null],
            ]} />
            {data && !data.ok && <p className="text-xs text-muted-foreground">IDs, bank details, phone and salary are shown to HR and Admin only.</p>}
          </div>

          {/* right: photo + ID card */}
          <div className="space-y-5">
            <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-start gap-4">
              <div className="relative">
                <EmployeePhoto path={e.photo_path} className="w-full" onClick={e.photo_path ? () => setBig(true) : undefined} />
                {e.photo_path && (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] shadow-sm">
                    <Maximize2 className="h-3 w-3" /> Enlarge
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photo</div>
                <p className="text-muted-foreground">{e.photo_path ? "Printed on the ID card." : "No photo yet. Add one with Edit; the card prints a placeholder until then."}</p>
              </div>
            </div>

            <section className="space-y-2 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID card · front and back</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={printing} onClick={() => onCard("card")}><Download className="h-4 w-4 mr-1" /> Card PDF</Button>
                  <Button size="sm" variant="outline" disabled={printing} onClick={() => onCard("a4")}><Printer className="h-4 w-4 mr-1" /> A4 sheet</Button>
                </div>
              </div>
              <IdCardPreview e={e} />
              <p className="text-xs text-muted-foreground">Card PDF: 54 × 86 mm pages for a PVC card printer. A4 sheet: print both sides (flip on long edge) and cut.</p>
            </section>
          </div>
        </div>

        {big && (
          <Dialog open onOpenChange={setBig}>
            <DialogContent className="w-[min(92vw,560px)] max-w-none p-4">
              <DialogHeader><DialogTitle>{employeeName(e)}</DialogTitle></DialogHeader>
              <EmployeePhoto path={e.photo_path} className="w-full" />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
