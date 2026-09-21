import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, ChevronsUpDown, Layers, Plus, Trash2 } from "lucide-react";
import { useParts } from "@/hooks/useParts";
import { useBomTree, useBomMutations, BomTreeNode } from "@/hooks/useBOM";
import { toast } from "sonner";

const SOURCE_LABEL: Record<string, string> = {
  PURCHASED: "Purchased",
  ASSEMBLED_STOCKED: "Assembled (stocked)",
  ASSEMBLED_INLINE: "Assembled (in line)",
  FINISHED_GOOD: "Finished good",
};

const PartPicker = ({
  parts,
  value,
  onChange,
  placeholder,
}: {
  parts: any[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = parts.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selected ? `${selected.part_code} — ${selected.name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by code or name..." />
          <CommandList>
            <CommandEmpty>No parts found.</CommandEmpty>
            <CommandGroup>
              {parts.map((part) => (
                <CommandItem
                  key={part.id}
                  value={`${part.part_code} ${part.name} ${part.category}`}
                  onSelect={() => {
                    onChange(part.id);
                    setOpen(false);
                  }}
                >
                  <span className="font-mono text-xs bg-muted px-1 rounded mr-2">{part.part_code}</span>
                  <span>{part.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {SOURCE_LABEL[part.source_type] || part.source_type}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const TreeRow = ({
  node,
  onRemove,
}: {
  node: BomTreeNode;
  onRemove: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-1" style={{ paddingLeft: node.level * 20 }}>
            {hasChildren ? (
              <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="inline-block w-4" />
            )}
            <span className="font-mono text-xs bg-muted px-1 rounded">{node.part_code}</span>
          </div>
        </TableCell>
        <TableCell>{node.name}</TableCell>
        <TableCell>
          <Badge variant={node.source_type === "PURCHASED" ? "secondary" : "default"} className="text-xs">
            {SOURCE_LABEL[node.source_type] || node.source_type}
          </Badge>
        </TableCell>
        <TableCell className="tabular-nums">{node.quantity}</TableCell>
        <TableCell>{node.uom}</TableCell>
        <TableCell className="text-right">
          {node.level === 0 && node.bom_id && (
            <Button variant="outline" size="sm" onClick={() => onRemove(node.bom_id!)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
      {expanded && node.children.map((child) => (
        <TreeRow key={`${child.bom_id}-${child.part_id}`} node={child} onRemove={onRemove} />
      ))}
    </>
  );
};

export const BOMManager = () => {
  const { parts, isLoading } = useParts();
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isCritical, setIsCritical] = useState(false);

  const { tree, parentIds } = useBomTree(parentId || undefined);
  const { addLine, removeLine } = useBomMutations();

  const activeParts = useMemo(() => parts.filter((p: any) => p.is_active), [parts]);
  const parentCandidates = useMemo(
    () => activeParts.filter((p: any) => p.source_type !== "PURCHASED"),
    [activeParts],
  );
  const parentPart = parts.find((p: any) => p.id === parentId);
  const childCandidates = useMemo(
    () => activeParts.filter((p: any) => p.id !== parentId),
    [activeParts, parentId],
  );

  const handleAdd = async () => {
    if (!parentId) {
      toast.error("Choose the part the bill of materials belongs to");
      return;
    }
    if (parentPart?.source_type === "PURCHASED") {
      toast.error("A purchased part cannot have a bill of materials. Change its type first.");
      return;
    }
    if (!childId) {
      toast.error("Choose the part to add");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be more than zero");
      return;
    }
    const child = parts.find((p: any) => p.id === childId);
    await addLine.mutateAsync({
      parent_part_id: parentId,
      child_part_id: childId,
      quantity: qty,
      uom: child?.uom || "PCS",
      is_critical: isCritical,
    });
    setChildId("");
    setQuantity("1");
    setIsCritical(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Bill of Materials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Part this bill of materials belongs to</Label>
              <PartPicker
                parts={parentCandidates}
                value={parentId}
                onChange={setParentId}
                placeholder={isLoading ? "Loading parts..." : "Select a finished good or assembly..."}
              />
              <p className="text-xs text-muted-foreground">
                Only finished goods and assemblies can have a bill of materials.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Part to add</Label>
              <PartPicker
                parts={childCandidates}
                value={childId}
                onChange={setChildId}
                placeholder="Select any part..."
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity per unit</Label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Critical</Label>
              <div className="flex items-center gap-2 h-10">
                <Checkbox
                  id="bom-critical"
                  checked={isCritical}
                  onCheckedChange={(checked) => setIsCritical(checked as boolean)}
                />
                <Label htmlFor="bom-critical" className="text-sm">Mark as critical</Label>
                <Button className="ml-auto" onClick={handleAdd} disabled={addLine.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  {addLine.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {parentPart ? `${parentPart.part_code} — ${parentPart.name}` : "Structure"}
            {parentIds.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {parentIds.length} part(s) have a bill of materials
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!parentId ? (
            <p className="text-center py-8 text-muted-foreground">
              Select a part above to see its structure.
            </p>
          ) : tree.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nothing added yet for this part.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tree.map((node) => (
                  <TreeRow
                    key={`${node.bom_id}-${node.part_id}`}
                    node={node}
                    onRemove={(id) => removeLine.mutate(id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
