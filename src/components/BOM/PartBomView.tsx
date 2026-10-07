import { Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmpty, TableSkeleton } from "@/components/ui/table-state";
import { useBomLines, useBomTree, type BomTreeNode } from "@/hooks/useBOM";

/**
 * The bill of materials of one part, read-only, as saved on the Bill of
 * Materials tab. A sub-assembly inside it is opened underneath its line, so a
 * finished good shows everything down to the purchased parts.
 */
export const PartBomView = ({ partId }: { partId: string }) => {
  const { tree, isLoading } = useBomTree(partId);

  const rows = (nodes: BomTreeNode[]): JSX.Element[] =>
    nodes.map((n) => (
      <Fragment key={`${n.bom_id}-${n.level}`}>
        <TableRow>
          <TableCell className="font-mono whitespace-nowrap" style={{ paddingLeft: `${12 + n.level * 20}px` }}>
            {n.level > 0 && <span className="text-muted-foreground mr-1">└</span>}
            {n.part_code}
          </TableCell>
          <TableCell>{n.name}</TableCell>
          <TableCell className="text-right tabular-nums">{n.bulk ? "Bulk" : n.quantity}</TableCell>
          <TableCell>{n.uom}</TableCell>
        </TableRow>
        {rows(n.children)}
      </Fragment>
    ));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-36">Part Code</TableHead>
          <TableHead>Part Name</TableHead>
          <TableHead className="w-20 text-right">QPS</TableHead>
          <TableHead className="w-20">Unit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableSkeleton columns={4} rows={3} />
        ) : tree.length === 0 ? (
          <TableEmpty columns={4} message="No bill of materials yet" hint="Make one on the Bill of Materials tab." />
        ) : (
          rows(tree)
        )}
      </TableBody>
    </Table>
  );
};

/**
 * Used In, worked out from the production BOMs (never typed):
 *   goes into   the parts whose BOM lists this one directly (sub-assembly or finished good)
 *   used in     the finished goods at the end of every chain
 */
export const PartWhereUsed = ({ partId }: { partId: string }) => {
  const { data: lines = [] } = useBomLines();
  const all = lines as any[];
  const direct = all.filter((l) => l.child_part_id === partId)
    .sort((a, b) => (a.parent?.part_code ?? "").localeCompare(b.parent?.part_code ?? ""));
  if (!direct.length) return <p className="text-sm text-muted-foreground">Not in any BOM yet.</p>;

  // Walk up through sub-assemblies to the finished goods.
  const fgs = new Map<string, any>();
  const seen = new Set<string>();
  const up = (id: string, depth: number) => {
    if (seen.has(id) || depth > 10) return;
    seen.add(id);
    for (const l of all.filter((x) => x.child_part_id === id)) {
      if (l.parent?.source_type === "FINISHED_GOOD") fgs.set(l.parent.id, l.parent);
      else up(l.parent_part_id, depth + 1);
    }
  };
  up(partId, 0);
  const chip = (code: string, name: string, extra?: string) => (
    <span key={code} className="rounded border px-2 py-1 text-sm">
      <span className="font-mono">{code}</span> {name}{extra && <span className="text-muted-foreground"> · {extra}</span>}
    </span>
  );
  const viaSub = direct.some((l) => l.parent?.source_type !== "FINISHED_GOOD");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-24">Goes into</span>
        {direct.map((l) => chip(l.parent?.part_code ?? "?", l.parent?.name ?? "",
          `${l.parent?.source_type === "FINISHED_GOOD" ? "finished good" : "sub-assembly"}, QPS ${l.issue_mode === "BULK" ? "bulk" : Number(l.quantity)}`))}
      </div>
      {viaSub && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-24">Finished goods</span>
          {fgs.size ? [...fgs.values()].sort((a, b) => a.part_code.localeCompare(b.part_code)).map((f) => chip(f.part_code, f.name))
            : <span className="text-sm text-muted-foreground">none yet</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Where a part is used, as two tables: the BOMs it goes into directly, and the
 * finished goods it ends up in (walking up through sub-assemblies), with the
 * quantity of it in one finished good.
 */
export const PartUsedInTables = ({ partId, note }: { partId: string; note?: string | null }) => {
  const { data: lines = [], isLoading } = useBomLines();
  const all = lines as any[];
  const direct = all.filter((l) => l.child_part_id === partId)
    .sort((a, b) => (a.parent?.part_code ?? "").localeCompare(b.parent?.part_code ?? ""));

  // Every path up to a finished good: the sub-assemblies on the way and the quantity multiplied along it.
  const fgs = new Map<string, { part: any; qty: number | null; via: Set<string> }>();
  const up = (id: string, qty: number | null, via: string[], seen: Set<string>) => {
    if (seen.has(id) || via.length > 10) return;
    const next = new Set(seen).add(id);
    for (const l of all.filter((x) => x.child_part_id === id)) {
      const q = qty == null || l.issue_mode === "BULK" ? null : qty * Number(l.quantity ?? 0);
      if (l.parent?.source_type === "FINISHED_GOOD") {
        const cur = fgs.get(l.parent.id) ?? { part: l.parent, qty: 0, via: new Set<string>() };
        cur.qty = cur.qty == null || q == null ? null : cur.qty + q;
        via.forEach((v) => cur.via.add(v));
        fgs.set(l.parent.id, cur);
      } else {
        up(l.parent_part_id, q, [...via, l.parent?.part_code ?? "?"], next);
      }
    }
  };
  up(partId, 1, [], new Set());
  const fgRows = [...fgs.values()].sort((a, b) => a.part.part_code.localeCompare(b.part.part_code));
  const num = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2 min-w-0">
        <h4 className="text-sm font-semibold">Used In <span className="font-normal text-muted-foreground">· BOMs it goes into directly</span></h4>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">QPS</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={4} rows={2} />
                : direct.length === 0 ? <TableEmpty columns={4} message="Not in any BOM yet" />
                : direct.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono whitespace-nowrap">{l.parent?.part_code}</TableCell>
                    <TableCell>{l.parent?.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.parent?.source_type === "FINISHED_GOOD" ? "Finished good" : "Sub-assembly"}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.issue_mode === "BULK" ? "Bulk" : num(Number(l.quantity))}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {note && <p className="text-xs text-muted-foreground">Earlier typed note: {note}</p>}
      </div>
      <div className="space-y-2 min-w-0">
        <h4 className="text-sm font-semibold">Finished Goods <span className="font-normal text-muted-foreground">· products it ends up in</span></h4>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Via</TableHead><TableHead className="text-right">Qty / unit</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton columns={4} rows={2} />
                : fgRows.length === 0 ? <TableEmpty columns={4} message="No finished good uses it yet" />
                : fgRows.map((f) => (
                  <TableRow key={f.part.id}>
                    <TableCell className="font-mono whitespace-nowrap">{f.part.part_code}</TableCell>
                    <TableCell>{f.part.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{f.via.size ? [...f.via].join(", ") : "direct"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.qty == null ? "Bulk" : num(f.qty)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
