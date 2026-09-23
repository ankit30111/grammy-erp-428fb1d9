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
          <TableCell className="text-right tabular-nums">{n.quantity}</TableCell>
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

/** Every part whose bill of materials includes this one. */
export const PartWhereUsed = ({ partId }: { partId: string }) => {
  const { data: lines = [] } = useBomLines();
  const parents = (lines as any[])
    .filter((l) => l.child_part_id === partId)
    .sort((a, b) => (a.parent?.part_code ?? "").localeCompare(b.parent?.part_code ?? ""));
  if (!parents.length) return <p className="text-sm text-muted-foreground">Not on any bill of materials yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {parents.map((l) => (
        <span key={l.id} className="rounded border px-2 py-1 text-sm">
          <span className="font-mono">{l.parent?.part_code}</span> {l.parent?.name}
          <span className="text-muted-foreground"> · QPS {Number(l.quantity)}</span>
        </span>
      ))}
    </div>
  );
};
