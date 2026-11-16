import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShortageRow } from "@/hooks/useShortages";

interface MaterialShortageDetailsProps {
  shortage: ShortageRow | null;
  isOpen: boolean;
  onClose: () => void;
}

const num = (v: number) => Number(v || 0).toLocaleString("en-IN");
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "—");
const PO_STATUS: Record<string, string> = { PENDING_APPROVAL: "Waiting for approval", APPROVED: "Approved", PARTIALLY_RECEIVED: "Partly received" };

/** One part: the sum behind its shortage, the POs already placed, and who needs it. */
const MaterialShortageDetails = ({ shortage: s, isOpen, onClose }: MaterialShortageDetailsProps) => {
  if (!s) return null;

  const sum: [string, number, string][] = [
    ["Still to issue to open vouchers", s.hold, "+"],
    ["Projections not yet on a voucher", s.required, "+"],
    ["In store", s.available, "−"],
    ["Waiting for IQC", s.at_iqc, "−"],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="mr-2 font-mono">{s.part_code}</span>
            <span className="font-normal">{s.name}</span>
          </DialogTitle>
          <DialogDescription>
            {s.vendor_name ? `Vendor: ${s.vendor_name}` : "No vendor set for this part"} · needed on {fmtDate(s.needed_on)} · unit {s.uom}
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-md border text-sm">
          {sum.map(([label, value, sign]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2">
              <dt className="text-muted-foreground"><span className="mr-2 inline-block w-3 text-center">{sign}</span>{label}</dt>
              <dd className="tabular-nums">{num(value)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between bg-muted/40 px-3 py-2 font-medium">
            <dt><span className="mr-2 inline-block w-3 text-center">=</span>Shortage</dt>
            <dd className="tabular-nums">{num(s.shortage)}</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted-foreground"><span className="mr-2 inline-block w-3 text-center">−</span>On order (approved POs, not yet received)</dt>
            <dd className="tabular-nums">{num(s.on_order)}</dd>
          </div>
          <div className="flex items-center justify-between bg-muted/40 px-3 py-2 font-semibold">
            <dt><span className="mr-2 inline-block w-3 text-center">=</span>To order</dt>
            <dd className="tabular-nums">{s.to_order > 0 ? <Badge variant="destructive">{num(s.to_order)}</Badge> : "0"}</dd>
          </div>
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Purchase orders already placed</h3>
          {s.pending_pos.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead><TableHead>Vendor</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Yet to come</TableHead><TableHead className="text-right">On the way</TableHead><TableHead>Expected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.pending_pos.map((po) => (
                    <TableRow key={po.po_number}>
                      <TableCell className="font-mono">{po.po_number}{po.is_import && <Badge variant="outline" className="ml-2">Import</Badge>}</TableCell>
                      <TableCell>{po.vendor || "—"}</TableCell>
                      <TableCell>{PO_STATUS[po.status] ?? po.status}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(po.pending)}</TableCell>
                      <TableCell className="text-right tabular-nums">{po.on_the_way ? num(po.on_the_way) : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(po.expected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {s.pending_pos.some((po) => po.status === "PENDING_APPROVAL") && (
            <p className="text-xs text-muted-foreground">A PO waiting for approval is shown here but is not counted as on order until it is approved.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Who needs it</h3>
          {s.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open demand.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>For</TableHead><TableHead>Customer</TableHead><TableHead>Needed on</TableHead><TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.sources.map((source, index) => (
                    <TableRow key={`${source.label}-${index}`}>
                      <TableCell>{source.label}</TableCell>
                      <TableCell>{source.customer || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(source.needed_on)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(source.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialShortageDetails;
