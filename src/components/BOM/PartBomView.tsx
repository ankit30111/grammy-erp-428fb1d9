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
