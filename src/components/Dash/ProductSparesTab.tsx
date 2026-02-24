import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDashProductSpares, useDashProductSpareMutations, useDashSpareParts } from "@/hooks/useDashProducts";
import { Link2, Unlink, Loader2 } from "lucide-react";
import { useState } from "react";

interface ProductSparesTabProps {
  productId: string | undefined;
}

export default function ProductSparesTab({ productId }: ProductSparesTabProps) {
  const { data: linkedSpares, isLoading } = useDashProductSpares(productId);
  const { data: allSpares } = useDashSpareParts();
  const { linkSpare, unlinkSpare } = useDashProductSpareMutations();
  const [selectedSpare, setSelectedSpare] = useState("");

  if (!productId) {
    return <p className="text-muted-foreground text-center py-8">Save the product first to link spares.</p>;
  }

  const linkedIds = new Set(linkedSpares?.map((ls: any) => ls.spare_id) || []);
  const availableSpares = allSpares?.filter((s: any) => !linkedIds.has(s.id)) || [];

  const handleLink = () => {
    if (!selectedSpare || !productId) return;
    linkSpare.mutate({ productId, spareId: selectedSpare });
    setSelectedSpare("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedSpare} onValueChange={setSelectedSpare}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Select spare to link..." /></SelectTrigger>
          <SelectContent>
            {availableSpares.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.spare_code} — {s.spare_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleLink} disabled={!selectedSpare || linkSpare.isPending}>
          <Link2 className="h-4 w-4 mr-2" />Link
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Spare Name</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedSpares?.map((ls: any) => (
              <TableRow key={ls.id}>
                <TableCell className="font-mono">{ls.dash_spare_parts?.spare_code}</TableCell>
                <TableCell>{ls.dash_spare_parts?.spare_name}</TableCell>
                <TableCell>
                  <Badge variant={ls.dash_spare_parts?.stock_quantity <= ls.dash_spare_parts?.low_stock_threshold ? "destructive" : "outline"}>
                    {ls.dash_spare_parts?.stock_quantity}
                  </Badge>
                </TableCell>
                <TableCell>₹{Number(ls.dash_spare_parts?.cost_price || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => unlinkSpare.mutate({ id: ls.id })}>
                    <Unlink className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!linkedSpares || linkedSpares.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No spares linked yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
