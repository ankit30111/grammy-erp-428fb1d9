import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDashProductSpareParts, useDashProductSparePartsMutations } from "@/hooks/useDashProducts";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

interface ProductSparesTabProps {
  productId: string | undefined;
}

export default function ProductSparesTab({ productId }: ProductSparesTabProps) {
  const { data: spareParts, isLoading } = useDashProductSpareParts(productId);
  const { addSparePart, deleteSparePart } = useDashProductSparePartsMutations();

  const [newPart, setNewPart] = useState({
    part_name: "", part_number: "", description: "",
    unit_cost: 0, selling_price: 0, current_stock: 0, reorder_level: 5,
  });

  if (!productId) {
    return <p className="text-muted-foreground text-center py-8">Save the product first to manage spare parts.</p>;
  }

  const handleAdd = () => {
    if (!newPart.part_name || !newPart.part_number) return;
    addSparePart.mutate({ product_id: productId, ...newPart });
    setNewPart({ part_name: "", part_number: "", description: "", unit_cost: 0, selling_price: 0, current_stock: 0, reorder_level: 5 });
  };

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add Spare Part</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Part Name *</Label>
            <Input value={newPart.part_name} onChange={(e) => setNewPart({ ...newPart, part_name: e.target.value })} placeholder="e.g. Tweeter Driver" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Part Number *</Label>
            <Input value={newPart.part_number} onChange={(e) => setNewPart({ ...newPart, part_number: e.target.value })} placeholder="e.g. SP-TW-001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit Cost (₹)</Label>
            <Input type="number" value={newPart.unit_cost} onChange={(e) => setNewPart({ ...newPart, unit_cost: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Selling Price (₹)</Label>
            <Input type="number" value={newPart.selling_price} onChange={(e) => setNewPart({ ...newPart, selling_price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Current Stock</Label>
            <Input type="number" value={newPart.current_stock} onChange={(e) => setNewPart({ ...newPart, current_stock: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reorder Level</Label>
            <Input type="number" value={newPart.reorder_level} onChange={(e) => setNewPart({ ...newPart, reorder_level: Number(e.target.value) })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={newPart.description} onChange={(e) => setNewPart({ ...newPart, description: e.target.value })} placeholder="Optional description" />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!newPart.part_name || !newPart.part_number || addSparePart.isPending} size="sm">
          {addSparePart.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Add Part
        </Button>
      </div>

      {/* Parts table */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Selling Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Reorder</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spareParts?.map((part: any) => (
              <TableRow key={part.id}>
                <TableCell className="font-mono text-xs">{part.part_number}</TableCell>
                <TableCell>{part.part_name}</TableCell>
                <TableCell>₹{Number(part.unit_cost || 0).toLocaleString()}</TableCell>
                <TableCell>₹{Number(part.selling_price || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={part.current_stock <= part.reorder_level ? "destructive" : "outline"}>
                    {part.current_stock}
                  </Badge>
                </TableCell>
                <TableCell>{part.reorder_level}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteSparePart.mutate(part.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!spareParts || spareParts.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">No spare parts added yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
