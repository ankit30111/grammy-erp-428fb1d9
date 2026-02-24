import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Eye } from "lucide-react";
import { useState } from "react";

const categories = [
  "Party Speaker", "Tower Speaker", "Soundbar", "Portable Speaker",
  "Accessories", "Multimedia Speaker", "Home Theatre", "Subwoofer", "Other",
];
const statuses = ["Development", "Ready for Production", "Active", "Discontinued"];

interface ProductListViewProps {
  products: any[] | undefined;
  isLoading: boolean;
  onAddNew: () => void;
  onSelect: (product: any) => void;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "Active": return "default";
    case "Discontinued": return "secondary";
    case "Development": return "outline";
    case "Ready for Production": return "default";
    default: return "outline";
  }
};

export default function ProductListView({ products, isLoading, onAddNew, onSelect }: ProductListViewProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = products?.filter((p: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      p.product_name?.toLowerCase().includes(s) ||
      p.model_number?.toLowerCase().includes(s) ||
      p.barcode_ean?.toLowerCase().includes(s) ||
      p.serial_prefix?.toLowerCase().includes(s);
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, model, EAN, serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={onAddNew}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>NLC</TableHead>
                <TableHead>DP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => onSelect(p)}>
                  <TableCell className="font-mono font-medium">{p.model_number}</TableCell>
                  <TableCell>{p.product_name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell>₹{Number(p.mrp).toLocaleString()}</TableCell>
                  <TableCell>₹{Number(p.nlc || 0).toLocaleString()}</TableCell>
                  <TableCell>₹{Number(p.dp || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSelect(p); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {isLoading ? "Loading..." : "No products found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
